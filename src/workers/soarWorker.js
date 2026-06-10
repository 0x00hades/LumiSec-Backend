import { soarQueue } from "../utils/queue.js";
import { blockIPFortigate } from "../integrations/firewall.js";
import { enrichIP } from "../integrations/opencti.js";
import { isolateHost } from "../integrations/ssh.js";
import { isolateWindowsHost } from "../integrations/winrm.js";
import { sendEmail } from "../integrations/mailer.js";
import { Incident, Playbook } from "../../database/index.js";
import { emitAlert } from "../utils/socket.js";
import { logger } from "../utils/logger.js";

soarQueue.process("executePlaybook", async (job) => {
    const { incidentId, playbookId, context } = job.data;

    const playbook = await Playbook.findById(playbookId);
    if (!playbook) throw new Error("Playbook not found");

    const sortedActions = playbook.actions.sort((a, b) => a.order - b.order);
    const results = [];

    for (const action of sortedActions) {
        let result;
        try {
            switch (action.type) {
                case "block_ip":
                    result = await blockIPFortigate(context.sourceIP, `Incident ${incidentId}`);
                    break;
                case "enrich":
                    result = await enrichIP(context.sourceIP);
                    // Save enrichment back to incident
                    await Incident.findByIdAndUpdate(incidentId, { enrichment: result });
                    break;
                case "isolate_host":
                    result = action.params?.os === "windows"
                        ? await isolateWindowsHost()
                        : await isolateHost();
                    break;
                case "notify":
                    result = await sendEmail({
                        to: action.params?.to,
                        subject: `[LumiSec Alert] Incident ${incidentId}`,
                        html: `<p>Incident <strong>${incidentId}</strong> triggered playbook: ${playbook.name}</p>`
                    });
                    break;
                case "ssh_command":
                    const { runCommand } = await import("../integrations/ssh.js");
                    result = await runCommand(action.params?.command);
                    break;
                default:
                    result = { skipped: true, reason: "unknown action type" };
            }

            results.push({ action: action.type, success: true, result });

            // Log to incident
            await Incident.findByIdAndUpdate(incidentId, {
                $push: { actions: { action: action.type, result: JSON.stringify(result) } }
            });

        } catch (err) {
            logger.error(`Playbook action failed: ${action.type}`, err);
            results.push({ action: action.type, success: false, error: err.message });
        }
    }

    emitAlert("soc_analyst", "playbook:completed", { incidentId, playbookId, results });
    return results;
});

logger.info("SOAR worker started");
