import { PlaybookRun, PlaybookRunStep } from "../../../../database/index.js";
import { playbookRunStatus, playbookStepStatus } from "../../../utils/constant/enums.js";
import { soarQueue } from "../../../utils/queue.js";

export const createRun = async ({ playbook, incidentId, userId, context }) => {
    const run = await PlaybookRun.create({
        playbookId: playbook._id,
        incidentId,
        startedBy: userId,
        status: playbookRunStatus.QUEUED,
        context
    });

    const steps = playbook.actions.map((action, index) => ({
        runId: run._id,
        stepIndex: index,
        actionId: action.id || `step-${index}`,
        actionType: action.type,
        status: playbookStepStatus.PENDING
    }));

    await PlaybookRunStep.insertMany(steps);
    return run;
};

export const queueRun = async (run, playbook, context) => {
    await soarQueue.add("executePlaybookRun", {
        runId: run._id,
        playbookId: playbook._id,
        incidentId: run.incidentId,
        context
    }, { attempts: 3, backoff: { type: "exponential", delay: 2000 } });
};

export const pauseRun = async (runId) => {
    const run = await PlaybookRun.findById(runId);
    if (!run) throw new Error("Run not found");
    if (run.status !== playbookRunStatus.RUNNING) throw new Error("Run is not running");
    run.status = playbookRunStatus.PAUSED;
    await run.save();
    return run;
};

export const resumeRun = async (runId) => {
    const run = await PlaybookRun.findById(runId);
    if (!run) throw new Error("Run not found");
    if (run.status !== playbookRunStatus.PAUSED) throw new Error("Run is not paused");
    run.status = playbookRunStatus.RUNNING;
    await run.save();
    await soarQueue.add("executePlaybookRun", { runId: run._id, resume: true }, { attempts: 3 });
    return run;
};

export const cancelRun = async (runId) => {
    const run = await PlaybookRun.findById(runId);
    if (!run) throw new Error("Run not found");
    run.status = playbookRunStatus.CANCELLED;
    run.completedAt = new Date();
    await run.save();
    return run;
};

export const evaluateCondition = (condition, context) => {
    if (!condition) return true;
    try {
        // eslint-disable-next-line no-new-func
        const fn = new Function("context", `return (${condition});`);
        return Boolean(fn(context));
    } catch {
        return false;
    }
};

export const getNextActions = (playbook, currentActionId, success) => {
    const action = playbook.actions.find((a) => a.id === currentActionId);
    if (!action) return [];
    const nextId = success ? action.nextOnSuccess : action.nextOnFailure;
    if (!nextId) return [];
    const next = playbook.actions.find((a) => a.id === nextId);
    return next ? [next] : [];
};
