import { Incident } from "../../../../database/index.js";
import { postIntegration } from "../../../utils/integrationClient.js";
import { indexDocument } from "../../../integrations/elk.js";
import { enrichIP } from "../../../integrations/opencti.js";
import { recordAudit } from "../../../utils/auditLogger.js";
import {
    auditAction, entityType, incidentSeverity, incidentStatus, sourceModule
} from "../../../utils/constant/enums.js";

const useHttp = () =>
    process.env.INTEGRATION_MODE === "http" && Boolean(process.env.INTERNAL_API_KEY);

export const pushGrcFinding = async (payload, user) => {
    const body = {
        title: payload.title,
        description: payload.description,
        severity: payload.severity,
        riskRating: payload.riskRating,
        asset: payload.asset || payload.assetIp,
        sourceId: payload.sourceId || payload.scanId,
        findingType: payload.findingType,
        tags: payload.tags || [payload.findingType, "network-scan"]
    };

    if (useHttp()) {
        return postIntegration("/api/grc/integrations/network/findings", body);
    }

    const { ingestNetworkFinding } = await import("../../grc/services/integration.service.js");
    const finding = await ingestNetworkFinding(body, user);
    await recordAudit({
        user,
        action: auditAction.EXECUTE,
        entityType: entityType.FINDING,
        entityId: finding._id,
        newValue: { integration: "network->grc", sourceId: body.sourceId }
    });
    return finding;
};

export const pushSoarIncident = async (payload, user) => {
    const body = {
        title: payload.title,
        description: payload.description,
        severity: payload.severity || incidentSeverity.HIGH,
        sourceIp: payload.sourceIp || payload.assetIp,
        affectedHost: payload.affectedHost || payload.asset,
        integrationType: sourceModule.NETWORK,
        tags: payload.tags || [sourceModule.NETWORK, payload.findingType || "scan"]
    };

    if (useHttp()) {
        return postIntegration("/api/soar/integrations/grc/finding", {
            incidentId: payload.sourceId,
            title: body.title,
            description: body.description,
            severity: body.severity,
            createRisk: payload.createRisk ?? true
        });
    }

    const incident = await Incident.create({
        title: body.title,
        description: body.description,
        severity: body.severity,
        status: incidentStatus.NEW,
        sourceIP: body.sourceIp,
        affectedHost: body.affectedHost,
        incidentType: sourceModule.NETWORK,
        tags: body.tags,
        createdBy: user._id
    });

    await recordAudit({
        user,
        action: auditAction.CREATE,
        entityType: entityType.INCIDENT,
        entityId: incident._id,
        newValue: { integration: "network->soar", sourceId: payload.sourceId }
    });

    return incident;
};

export const pushUctcDetectionGap = async (payload, user) => {
    const body = {
        assetIp: payload.assetIp,
        assetMac: payload.assetMac,
        service: payload.service,
        port: payload.port,
        gapType: payload.gapType || "missing-detection",
        description: payload.description
    };

    if (useHttp()) {
        return postIntegration("/api/uctc/integrations/network/coverage", body);
    }

    const { suggestRulesFromNetwork } = await import("../../uctc/services/integration.service.js");
    return suggestRulesFromNetwork(body, user);
};

export const pushSiemEvent = async (payload) => {
    const index = process.env.NETWORK_SIEM_INDEX || "lumisec-network-events";
    const document = {
        eventType: payload.eventType || "network_scan_complete",
        scanId: payload.scanId,
        target: payload.target,
        assetCount: payload.assetCount,
        severity: payload.severity,
        sourceModule: sourceModule.NETWORK,
        metadata: payload.metadata || {},
        timestamp: payload.timestamp || new Date().toISOString()
    };

    const elkResult = await indexDocument(index, document);
    return { forwarded: true, index, elkResult };
};

export const pushOpenCtiEnrichment = async (payload) => {
    const value = payload.ip || payload.domain || payload.hash || payload.cve;
    if (!value) return { enriched: false, reason: "No observable provided" };

    if (!process.env.OPENCTI_URL || !process.env.OPENCTI_TOKEN) {
        return { enriched: false, observable: value, mode: "unconfigured" };
    }

    try {
        const enrichment = await enrichIP(value);
        return { enriched: Boolean(enrichment), observable: value, enrichment };
    } catch {
        return { enriched: false, observable: value, mode: "unavailable" };
    }
};

export const autoIntegrateOnCriticalFinding = async ({ finding, scan, user }) => {
    if (!["high", "critical"].includes(finding.severity)) return;

    await pushSiemEvent({
        eventType: "network_critical_finding",
        scanId: scan?._id?.toString(),
        target: scan?.target,
        severity: finding.severity,
        metadata: { findingType: finding.findingType, asset: finding.asset }
    });

    await pushGrcFinding({
        title: finding.title,
        description: finding.description,
        severity: finding.severity,
        asset: finding.asset,
        sourceId: `${scan?._id || "manual"}:${finding.findingType}:${finding.asset}`,
        findingType: finding.findingType
    }, user);

    if (finding.severity === "critical") {
        await pushSoarIncident({
            title: finding.title,
            description: finding.description,
            severity: incidentSeverity.CRITICAL,
            sourceIp: finding.asset,
            sourceId: scan?._id?.toString(),
            findingType: finding.findingType
        }, user);
    }
};
