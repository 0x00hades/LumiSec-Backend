import { SiemAlert } from "../../../../database/index.js";
import { sourceModule, severity, riskLevel, entityType, notificationType } from "../../../utils/constant/enums.js";
import { auditCreate } from "../../../utils/auditLogger.js";
import { createNotification } from "../../../utils/notificationHelper.js";
import * as findingService from "./finding.service.js";
import * as riskService from "./risk.service.js";
import * as taskService from "./task.service.js";

const severityToRisk = {
    low: riskLevel.LOW,
    medium: riskLevel.MEDIUM,
    high: riskLevel.HIGH,
    critical: riskLevel.CRITICAL
};

export const ingestNetworkFinding = async (payload, user) => {
    const finding = await findingService.createFinding({
        title: payload.title,
        description: payload.description,
        severity: payload.severity,
        riskRating: payload.riskRating || severityToRisk[payload.severity] || riskLevel.MEDIUM,
        asset: payload.asset,
        sourceModule: sourceModule.NETWORK,
        sourceId: payload.sourceId,
        tags: payload.tags || [payload.findingType],
        assignedTo: payload.assignedTo
    }, user);

    await createNotification({
        userId: user._id,
        title: "Network finding ingested",
        message: `Finding "${finding.title}" created from network module`,
        type: notificationType.INTEGRATION,
        entityType: entityType.FINDING,
        entityId: finding._id
    });

    return finding;
};

export const ingestUctcFinding = async (payload, user) => {
    return findingService.createFinding({
        title: payload.title,
        description: payload.description,
        severity: payload.severity,
        riskRating: payload.riskRating || severityToRisk[payload.severity] || riskLevel.MEDIUM,
        asset: payload.asset,
        sourceModule: sourceModule.UCTC,
        sourceId: payload.testCaseId || payload.sourceId,
        tags: payload.tags || ["detection-gap"]
    }, user);
};

export const ingestSoarIncident = async (payload, user) => {
    const finding = await findingService.createFinding({
        title: payload.title || `SOAR Incident: ${payload.incidentId}`,
        description: payload.description,
        severity: payload.severity || severity.MEDIUM,
        riskRating: payload.riskRating || severityToRisk[payload.severity] || riskLevel.MEDIUM,
        sourceModule: sourceModule.SOAR,
        sourceId: payload.incidentId,
        tags: ["soar-incident"]
    }, user);

    let risk = null;
    if (payload.createRisk) {
        risk = await riskService.createRisk({
            findingId: finding._id,
            title: `Risk from SOAR incident ${payload.incidentId}`,
            description: payload.description,
            likelihood: payload.likelihood || 3,
            impact: payload.impact || 3,
            owner: user._id
        }, user);
    }

    return { finding, risk };
};

export const updateSoarTask = async (taskId, updates, user) => {
    return taskService.updateTask(taskId, updates, user);
};

export const ingestPhishingRisk = async (payload, user) => {
    const likelihood = payload.eventType === "submit" ? 4 : 3;
    const impact = payload.eventType === "submit" ? 5 : 3;

    return riskService.createRisk({
        title: payload.title || `Phishing risk: ${payload.eventType}`,
        description: payload.description || `Phishing ${payload.eventType} event detected`,
        likelihood,
        impact,
        owner: payload.owner || user._id,
        findingId: payload.findingId
    }, user);
};

export const ingestSiemAlert = async (payload, user) => {
    const alert = await SiemAlert.create({
        alertId: payload.alertId,
        ruleName: payload.ruleName,
        severity: payload.severity,
        sourceIp: payload.sourceIp,
        destinationIp: payload.destinationIp,
        indexName: payload.indexName,
        receivedAt: payload.receivedAt || new Date()
    });

    const finding = await findingService.createFinding({
        title: `SIEM Alert: ${payload.ruleName}`,
        description: `Alert ${payload.alertId} from index ${payload.indexName}. Source: ${payload.sourceIp || "unknown"}`,
        severity: payload.severity,
        riskRating: severityToRisk[payload.severity] || riskLevel.MEDIUM,
        asset: payload.destinationIp || payload.sourceIp,
        sourceModule: sourceModule.SIEM,
        sourceId: payload.alertId,
        tags: ["siem-alert", payload.ruleName]
    }, user);

    alert.findingId = finding._id;
    await alert.save();

    await auditCreate(user, entityType.SIEM_ALERT, alert);
    return { alert, finding };
};

export const ingestOpenCtiIoc = async (payload, user) => {
    const impact = payload.iocType === "malware" ? 5 : payload.iocType === "domain" ? 4 : 3;
    const likelihood = payload.confidence || 3;

    return riskService.createRisk({
        title: payload.title || `OpenCTI IOC: ${payload.indicator}`,
        description: payload.description || `Threat indicator ${payload.indicator} (${payload.iocType})`,
        likelihood,
        impact,
        owner: payload.owner || user._id
    }, user);
};
