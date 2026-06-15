import dotenv from "dotenv";
import { soarIntegrationQueue } from "../utils/queue.js";
import { connectDB } from "../../database/connection.js";
import { logger } from "../utils/logger.js";
import {
    IntegrationAction, SigmaRule, Campaign, Incident
} from "../../database/index.js";
import { integrationActionStatus, ruleStatus } from "../utils/constant/enums.js";
import { blockIPFortigate } from "../integrations/firewall.js";
import { isolateHost } from "../integrations/ssh.js";
import { isolateWindowsHost } from "../integrations/winrm.js";
import { indexDocument } from "../integrations/elk.js";
import { emitAlert } from "../utils/socket.js";

dotenv.config({ path: "./config/.env" });
await connectDB();

const PROCESS_OPTS = { concurrency: 2 };

const updateIntegrationAction = async (jobId, status, response) => {
    await IntegrationAction.findOneAndUpdate(
        { "response.jobId": jobId },
        { status, response: { jobId, ...response }, executedAt: new Date() }
    );
};

soarIntegrationQueue.process("blockIp", PROCESS_OPTS.concurrency, async (job) => {
    const { ip, comment, incidentId } = job.data;
    const result = await blockIPFortigate(ip, comment || `SOAR block: ${incidentId || "manual"}`);
    await updateIntegrationAction(job.id, integrationActionStatus.SUCCESS, result);
    logger.info(`Blocked IP ${ip} via integration worker`);
    return result;
});

soarIntegrationQueue.process("isolateHost", PROCESS_OPTS.concurrency, async (job) => {
    const { host, os, incidentId } = job.data;
    const result = os === "windows"
        ? await isolateWindowsHost()
        : await isolateHost();
    const payload = { ...result, host, os: os || "linux" };
    await updateIntegrationAction(job.id, integrationActionStatus.SUCCESS, payload);
    logger.info(`Isolated host ${host || "default"} via integration worker`);
    return payload;
});

soarIntegrationQueue.process("pushSiemEvent", PROCESS_OPTS.concurrency, async (job) => {
    const { index, document } = job.data;
    const result = await indexDocument(index, document);
    await updateIntegrationAction(job.id, integrationActionStatus.SUCCESS, result);
    logger.info(`Pushed SIEM event to ${index}`);
    return result;
});

soarIntegrationQueue.process("triggerUctcRule", PROCESS_OPTS.concurrency, async (job) => {
    const { ruleId, incidentId, context = {} } = job.data;
    const rule = await SigmaRule.findById(ruleId);
    if (!rule) throw new Error("Sigma rule not found");

    const { deployRuleToSiem, pushSiemDeployEvent } = await import("../modules/uctc/services/integration.service.js");
    const deployment = await deployRuleToSiem(rule, { _id: job.data.userId });

    rule.status = ruleStatus.DEPLOYED;
    rule.deployedAt = new Date();
    rule.deploymentNote = `Deployed via SOAR integration worker`;
    await rule.save();

    await pushSiemDeployEvent({
        ruleId: rule._id.toString(),
        ruleTitle: rule.title,
        targetSiem: rule.targetSiem,
        metadata: { ...deployment, incidentId, context }
    });

    const result = { ruleId, ruleTitle: rule.title, incidentId, context, deployment, triggered: true };
    await updateIntegrationAction(job.id, integrationActionStatus.SUCCESS, result);
    emitAlert("detection_engineer", "soar:uctc-triggered", result);
    logger.info(`Triggered and deployed UCTC rule ${ruleId}`);
    return result;
});

soarIntegrationQueue.process("linkPhishingCampaign", PROCESS_OPTS.concurrency, async (job) => {
    const { campaignId, incidentId, action = "notify" } = job.data;

    const [campaign, incident] = await Promise.all([
        Campaign.findById(campaignId),
        incidentId ? Incident.findById(incidentId) : null
    ]);

    if (!campaign) throw new Error("Campaign not found");
    if (incidentId && !incident) throw new Error("Incident not found");

    const result = {
        campaignId,
        campaignName: campaign.name,
        incidentId,
        action,
        linked: true
    };

    await updateIntegrationAction(job.id, integrationActionStatus.SUCCESS, result);
    emitAlert("phishing_manager", "soar:phishing-linked", result);
    logger.info(`Linked phishing campaign ${campaignId} to incident ${incidentId || "none"}`);
    return result;
});

logger.info("SOAR integration worker started");
