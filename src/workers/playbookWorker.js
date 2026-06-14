import dotenv from "dotenv";
import { soarQueue } from "../utils/queue.js";
import { connectDB } from "../../database/connection.js";
import { logger } from "../utils/logger.js";
import { blockIPFortigate } from "../integrations/firewall.js";
import { enrichIP } from "../integrations/opencti.js";
import { isolateHost, runCommand } from "../integrations/ssh.js";
import { isolateWindowsHost } from "../integrations/winrm.js";
import { sendEmail } from "../integrations/mailer.js";
import {
    Incident, Playbook, PlaybookRun, PlaybookRunStep
} from "../../database/index.js";
import { playbookRunStatus, playbookStepStatus } from "../utils/constant/enums.js";
import { emitAlert } from "../utils/socket.js";
import * as playbookEngine from "../modules/soar/engine/playbookEngine.js";
import * as playbookService from "../modules/soar/services/playbook.service.js";

dotenv.config({ path: "./config/.env" });
await connectDB();

const PROCESS_OPTS = { concurrency: 1 };

const executeAction = async (action, context, incidentId) => {
    switch (action.type) {
        case "block_ip":
            return blockIPFortigate(context.sourceIP, `Incident ${incidentId}`);
        case "enrich": {
            const result = await enrichIP(context.sourceIP);
            await Incident.findByIdAndUpdate(incidentId, { enrichment: result });
            return result;
        }
        case "isolate_host":
            return action.params?.os === "windows"
                ? isolateWindowsHost()
                : isolateHost();
        case "notify":
            return sendEmail({
                to: action.params?.to,
                subject: `[LumiSec Alert] Incident ${incidentId}`,
                html: `<p>Incident <strong>${incidentId}</strong> triggered playbook action: ${action.type}</p>`
            });
        case "ssh_command":
            return runCommand(action.params?.command);
        default:
            return { skipped: true, reason: "unknown action type" };
    }
};

const runPlaybookActions = async ({ runId, playbookId, incidentId, context = {}, resume = false }) => {
    const [run, playbook] = await Promise.all([
        PlaybookRun.findById(runId),
        Playbook.findById(playbookId)
    ]);

    if (!run) throw new Error("Playbook run not found");
    if (!playbook) throw new Error("Playbook not found");

    if (run.status === playbookRunStatus.CANCELLED) return { cancelled: true };
    if (run.status === playbookRunStatus.PAUSED && !resume) return { paused: true };

    run.status = playbookRunStatus.RUNNING;
    if (!run.startedAt) run.startedAt = new Date();
    await run.save();

    const steps = await PlaybookRunStep.find({ runId }).sort({ stepIndex: 1 });
    const sortedActions = [...playbook.actions].sort((a, b) => a.order - b.order);
    const ctx = { ...run.context, ...context, incidentId };
    const results = [];

    for (let index = 0; index < sortedActions.length; index += 1) {
        const action = sortedActions[index];
        const step = steps.find((s) => s.stepIndex === index);
        const freshRun = await PlaybookRun.findById(runId);

        if (freshRun.status === playbookRunStatus.CANCELLED) break;
        if (freshRun.status === playbookRunStatus.PAUSED) break;
        if (step?.status === playbookStepStatus.COMPLETED) continue;

        if (step) {
            step.status = playbookStepStatus.RUNNING;
            step.startedAt = new Date();
            await step.save();
        }

        try {
            if (action.condition && !playbookEngine.evaluateCondition(action.condition, ctx)) {
                if (step) {
                    step.status = playbookStepStatus.SKIPPED;
                    step.completedAt = new Date();
                    await step.save();
                }
                results.push({ action: action.type, skipped: true });
                continue;
            }

            const result = await executeAction(action, ctx, incidentId);

            if (step) {
                step.status = playbookStepStatus.COMPLETED;
                step.result = result;
                step.completedAt = new Date();
                await step.save();
            }

            await Incident.findByIdAndUpdate(incidentId, {
                $push: { actions: { action: action.type, result: JSON.stringify(result), at: new Date() } }
            });

            results.push({ action: action.type, success: true, result });
        } catch (err) {
            logger.error(`Playbook action failed: ${action.type}`, err);
            if (step) {
                step.status = playbookStepStatus.FAILED;
                step.error = err.message;
                step.completedAt = new Date();
                await step.save();
            }
            results.push({ action: action.type, success: false, error: err.message });
        }
    }

    const finalRun = await PlaybookRun.findById(runId);
    if (![playbookRunStatus.CANCELLED, playbookRunStatus.PAUSED].includes(finalRun.status)) {
        const hasFailure = results.some((r) => r.success === false);
        finalRun.status = hasFailure ? playbookRunStatus.FAILED : playbookRunStatus.COMPLETED;
        finalRun.completedAt = new Date();
        await finalRun.save();
        await playbookService.notifyPlaybookCompleted(runId, run.startedBy);
    }

    emitAlert("soc_analyst", "playbook:completed", { runId, incidentId, playbookId, results });
    return results;
};

soarQueue.process("executePlaybookRun", PROCESS_OPTS.concurrency, async (job) => {
    const { runId, playbookId, incidentId, context, resume } = job.data;
    logger.info(`Executing playbook run ${runId}`);
    return runPlaybookActions({ runId, playbookId, incidentId, context, resume });
});

soarQueue.process("executePlaybook", PROCESS_OPTS.concurrency, async (job) => {
    const { incidentId, playbookId, context } = job.data;
    logger.info(`Legacy playbook execution for incident ${incidentId}`);

    const playbook = await Playbook.findById(playbookId);
    if (!playbook) throw new Error("Playbook not found");

    const sortedActions = [...playbook.actions].sort((a, b) => a.order - b.order);
    const results = [];

    for (const action of sortedActions) {
        try {
            const result = await executeAction(action, context || {}, incidentId);
            results.push({ action: action.type, success: true, result });
            await Incident.findByIdAndUpdate(incidentId, {
                $push: { actions: { action: action.type, result: JSON.stringify(result) } }
            });
        } catch (err) {
            logger.error(`Legacy playbook action failed: ${action.type}`, err);
            results.push({ action: action.type, success: false, error: err.message });
        }
    }

    emitAlert("soc_analyst", "playbook:completed", { incidentId, playbookId, results });
    return results;
});

logger.info("Playbook worker started");
