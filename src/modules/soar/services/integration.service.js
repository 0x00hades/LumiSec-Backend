import {
    Incident, IntegrationAction, Campaign, SigmaRule, SiemAlert
} from "../../../../database/index.js";
import { AppError } from "../../../utils/appError.js";
import { messages } from "../../../utils/constant/messages.js";
import {
    entityType, auditAction, integrationActionStatus,
    incidentSeverity, incidentStatus, sourceModule, severity
} from "../../../utils/constant/enums.js";
import { recordAudit } from "../../../utils/auditLogger.js";
import { soarIntegrationQueue } from "../../../utils/queue.js";
import { emitAlert } from "../../../utils/socket.js";
import { blockIPFortigate } from "../../../integrations/firewall.js";
import { isolateHost } from "../../../integrations/ssh.js";
import { isolateWindowsHost } from "../../../integrations/winrm.js";
import { indexDocument } from "../../../integrations/elk.js";
import * as grcIntegration from "../../grc/services/integration.service.js";

const logIntegrationAction = async ({ name, connectorId, incidentId, playbookRunId, status, request, response, user }) => {
    return IntegrationAction.create({
        name,
        connectorId,
        incidentId,
        playbookRunId,
        status,
        request,
        response,
        executedBy: user?._id,
        executedAt: new Date()
    });
};

export const pushGrcFinding = async (payload, user) => {
    const finding = await grcIntegration.ingestSoarIncident({
        incidentId: payload.incidentId,
        title: payload.title,
        description: payload.description,
        severity: payload.severity,
        createRisk: payload.createRisk,
        likelihood: payload.likelihood,
        impact: payload.impact
    }, user);

    const action = await logIntegrationAction({
        name: "Push GRC finding from SOAR",
        incidentId: payload.incidentId,
        status: integrationActionStatus.SUCCESS,
        request: payload,
        response: { findingId: finding.finding?._id || finding._id },
        user
    });

    await recordAudit({
        user,
        action: auditAction.EXECUTE,
        entityType: entityType.INTEGRATION_ACTION,
        entityId: action._id,
        newValue: { type: "grc_finding", findingId: finding.finding?._id || finding._id }
    });

    return { finding, action };
};

export const pushGrcRisk = async (payload, user) => {
    const risk = await grcIntegration.ingestPhishingRisk({
        title: payload.title,
        description: payload.description,
        eventType: payload.eventType,
        owner: payload.owner,
        findingId: payload.findingId
    }, user);

    const action = await logIntegrationAction({
        name: "Push GRC risk from SOAR",
        incidentId: payload.incidentId,
        status: integrationActionStatus.SUCCESS,
        request: payload,
        response: { riskId: risk._id },
        user
    });

    return { risk, action };
};

export const triggerUctcRule = async (payload, user) => {
    const rule = await SigmaRule.findById(payload.ruleId);
    if (!rule) throw new AppError(messages.sigmaRule.notFound, 404);

    const job = await soarIntegrationQueue.add("triggerUctcRule", {
        ruleId: rule._id,
        incidentId: payload.incidentId,
        context: payload.context || {},
        userId: user._id
    }, { attempts: 2 });

    const action = await logIntegrationAction({
        name: `Trigger UCTC rule: ${rule.title}`,
        incidentId: payload.incidentId,
        status: integrationActionStatus.PENDING,
        request: { ruleId: rule._id, context: payload.context },
        response: { jobId: job.id, queued: true },
        user
    });

    await recordAudit({
        user,
        action: auditAction.EXECUTE,
        entityType: entityType.INTEGRATION_ACTION,
        entityId: action._id,
        newValue: { type: "uctc_rule_trigger", ruleId: rule._id }
    });

    return { rule, jobId: job.id, action, queued: true };
};

export const pushPhishingCampaign = async (payload, user) => {
    const campaign = await Campaign.findById(payload.campaignId);
    if (!campaign) throw new AppError(messages.campaign.notFound, 404);

    const incident = payload.incidentId
        ? await Incident.findById(payload.incidentId)
        : null;

    if (payload.incidentId && !incident) {
        throw new AppError(messages.incident.notFound, 404);
    }

    const job = await soarIntegrationQueue.add("linkPhishingCampaign", {
        campaignId: campaign._id,
        incidentId: payload.incidentId,
        action: payload.action || "notify",
        userId: user._id
    });

    const action = await logIntegrationAction({
        name: `Phishing campaign integration: ${campaign.name}`,
        incidentId: payload.incidentId,
        status: integrationActionStatus.PENDING,
        request: payload,
        response: { campaignId: campaign._id, jobId: job.id },
        user
    });

    emitAlert("phishing_manager", "soar:phishing-linked", {
        campaignId: campaign._id,
        incidentId: payload.incidentId
    });

    return { campaign, jobId: job.id, action, queued: true };
};

export const blockIp = async (payload, user) => {
    const ip = payload.ip || payload.sourceIP;
    if (!ip) throw new AppError("IP address is required", 400);

    let result;
    let status = integrationActionStatus.SUCCESS;

    try {
        if (payload.async) {
            const job = await soarIntegrationQueue.add("blockIp", {
                ip,
                comment: payload.comment || `SOAR incident ${payload.incidentId || "manual"}`,
                incidentId: payload.incidentId,
                userId: user._id
            });
            result = { queued: true, jobId: job.id };
            status = integrationActionStatus.PENDING;
        } else {
            result = await blockIPFortigate(ip, payload.comment || `SOAR block: ${payload.incidentId || "manual"}`);
        }
    } catch (error) {
        status = integrationActionStatus.FAILED;
        throw new AppError(`${messages.integration.firewallError}: ${error.message}`, 502);
    }

    const action = await logIntegrationAction({
        name: `Block IP: ${ip}`,
        incidentId: payload.incidentId,
        connectorId: payload.connectorId,
        status,
        request: { ip, comment: payload.comment },
        response: result,
        user
    });

    await recordAudit({
        user,
        action: auditAction.EXECUTE,
        entityType: entityType.INTEGRATION_ACTION,
        entityId: action._id,
        newValue: { type: "block_ip", ip }
    });

    emitAlert("soc_analyst", "integration:block_ip", { ip, incidentId: payload.incidentId, result });

    return { result, action };
};

export const isolateHostAction = async (payload, user) => {
    const host = payload.host || payload.affectedHost;
    if (!host && !payload.forceDefault) {
        throw new AppError("Host identifier is required", 400);
    }

    let result;
    let status = integrationActionStatus.SUCCESS;

    try {
        if (payload.async) {
            const job = await soarIntegrationQueue.add("isolateHost", {
                host,
                os: payload.os,
                incidentId: payload.incidentId,
                userId: user._id
            });
            result = { queued: true, jobId: job.id };
            status = integrationActionStatus.PENDING;
        } else {
            result = payload.os === "windows"
                ? await isolateWindowsHost()
                : await isolateHost();
            result = { ...result, host, os: payload.os || "linux" };
        }
    } catch (error) {
        status = integrationActionStatus.FAILED;
        throw new AppError(`${messages.integration.vmError}: ${error.message}`, 502);
    }

    const action = await logIntegrationAction({
        name: `Isolate host: ${host || "default"}`,
        incidentId: payload.incidentId,
        connectorId: payload.connectorId,
        status,
        request: { host, os: payload.os },
        response: result,
        user
    });

    await recordAudit({
        user,
        action: auditAction.EXECUTE,
        entityType: entityType.INTEGRATION_ACTION,
        entityId: action._id,
        newValue: { type: "isolate_host", host }
    });

    emitAlert("soc_analyst", "integration:isolate_host", { host, incidentId: payload.incidentId, result });

    return { result, action };
};

export const pushSiemEvent = async (payload, user) => {
    const index = payload.index || process.env.SOAR_SIEM_INDEX || "lumisec-soar-events";

    const document = {
        eventType: payload.eventType || "soar_integration",
        incidentId: payload.incidentId,
        severity: payload.severity || severity.MEDIUM,
        sourceModule: sourceModule.SOAR,
        sourceIp: payload.sourceIp,
        destinationIp: payload.destinationIp,
        message: payload.message || payload.description,
        metadata: payload.metadata || {},
        timestamp: payload.timestamp || new Date().toISOString()
    };

    let elkResult = null;
    let status = integrationActionStatus.SUCCESS;

    try {
        if (payload.async) {
            const job = await soarIntegrationQueue.add("pushSiemEvent", { index, document, userId: user?._id });
            elkResult = { queued: true, jobId: job.id };
            status = integrationActionStatus.PENDING;
        } else {
            elkResult = await indexDocument(index, document);
        }
    } catch (error) {
        status = integrationActionStatus.FAILED;
        throw new AppError(`${messages.integration.elkError}: ${error.message}`, 502);
    }

    const siemAlert = await SiemAlert.create({
        alertId: payload.alertId || `soar-${Date.now()}`,
        ruleName: payload.ruleName || payload.eventType || "SOAR event",
        severity: payload.severity || severity.MEDIUM,
        sourceIp: payload.sourceIp,
        destinationIp: payload.destinationIp,
        indexName: index,
        receivedAt: new Date()
    });

    const action = await logIntegrationAction({
        name: `Push SIEM event: ${document.eventType}`,
        incidentId: payload.incidentId,
        status,
        request: document,
        response: { elkResult, siemAlertId: siemAlert._id },
        user
    });

    if (user) {
        await recordAudit({
            user,
            action: auditAction.EXECUTE,
            entityType: entityType.INTEGRATION_ACTION,
            entityId: action._id,
            newValue: { type: "siem_event", index }
        });
    }

    return { siemAlert, elkResult, action };
};

export const createIncidentFromIntegration = async (payload, user) => {
    const incident = await Incident.create({
        title: payload.title || "Integration-triggered incident",
        description: payload.description,
        severity: payload.severity || incidentSeverity.MEDIUM,
        status: incidentStatus.NEW,
        sourceIP: payload.sourceIp,
        affectedHost: payload.affectedHost,
        incidentType: payload.integrationType || sourceModule.SOAR,
        tags: payload.tags || [sourceModule.SOAR, "integration"],
        createdBy: user._id
    });

    emitAlert("soc_analyst", "incident:created", {
        incidentId: incident._id,
        title: incident.title,
        severity: incident.severity,
        source: "integration"
    });

    return incident;
};

export const queueIntegrationAction = async (actionType, payload, user) => {
    const job = await soarIntegrationQueue.add(actionType, {
        ...payload,
        userId: user._id
    });

    return { queued: true, jobId: job.id, actionType };
};
