import { NetworkAsset, SigmaRule } from "../../../../database/index.js";
import { postIntegration } from "../../../utils/integrationClient.js";
import { indexDocument } from "../../../integrations/elk.js";
import { getIOCs } from "../../../integrations/opencti.js";
import { recordAudit } from "../../../utils/auditLogger.js";
import {
    auditAction, entityType, incidentSeverity, incidentStatus, sourceModule, ruleStatus
} from "../../../utils/constant/enums.js";
import { convertSigmaRuleToTargets } from "../../../utils/helpers/sigmaConverter.js";
import { Incident } from "../../../../database/index.js";

const useHttp = () =>
    process.env.INTEGRATION_MODE === "http" && Boolean(process.env.INTERNAL_API_KEY);

export const pushGrcGapFinding = async (payload, user) => {
    const body = {
        title: payload.title || `Detection gap: ${payload.asset || payload.ruleTitle || "unknown asset"}`,
        description: payload.description || payload.gapDescription,
        severity: payload.severity || "medium",
        asset: payload.asset,
        testCaseId: payload.testCaseId || payload.gapId,
        sourceId: payload.sourceId || payload.gapId,
        tags: payload.tags || ["detection-gap", payload.gapType || "coverage"]
    };

    if (useHttp()) {
        return postIntegration("/api/grc/integrations/uctc/findings", body);
    }

    const { ingestUctcFinding } = await import("../../grc/services/integration.service.js");
    const finding = await ingestUctcFinding(body, user);
    await recordAudit({
        user,
        action: auditAction.EXECUTE,
        entityType: entityType.FINDING,
        entityId: finding._id,
        newValue: { integration: "uctc->grc", gapId: body.sourceId }
    });
    return finding;
};

export const pushSoarIncident = async (payload, user) => {
    const body = {
        title: payload.title || `UCTC alert: ${payload.ruleTitle || payload.gapType}`,
        description: payload.description,
        severity: payload.severity || incidentSeverity.HIGH,
        sourceIp: payload.sourceIp,
        affectedHost: payload.asset,
        integrationType: sourceModule.UCTC,
        tags: payload.tags || [sourceModule.UCTC, "detection-gap"]
    };

    if (useHttp()) {
        return postIntegration("/api/soar/integrations/grc/finding", {
            incidentId: payload.gapId || payload.testCaseId,
            title: body.title,
            description: body.description,
            severity: body.severity,
            createRisk: true
        });
    }

    const incident = await Incident.create({
        title: body.title,
        description: body.description,
        severity: body.severity,
        status: incidentStatus.NEW,
        sourceIP: body.sourceIp,
        affectedHost: body.affectedHost,
        incidentType: sourceModule.UCTC,
        tags: body.tags,
        createdBy: user._id
    });

    return incident;
};

export const getNetworkCoverage = async (payload) => {
    const filter = {};
    if (payload.assetIp) filter.ip = payload.assetIp;
    if (payload.assetMac) filter.mac = payload.assetMac;

    const assets = await NetworkAsset.find(filter).limit(50);
    const rules = await SigmaRule.find({
        status: { $in: [ruleStatus.CONVERTED, ruleStatus.DEPLOYED] }
    }).select("title logsource status deployedAt");

    return {
        assets,
        rules,
        coverageSummary: {
            assetCount: assets.length,
            deployedRuleCount: rules.filter((r) => r.status === ruleStatus.DEPLOYED).length
        }
    };
};

export const suggestRulesFromNetwork = async (payload, user) => {
    const coverage = await getNetworkCoverage(payload);
    const gaps = [];

    for (const asset of coverage.assets) {
        const hasRule = coverage.rules.some((rule) =>
            rule.logsource?.product === "windows" && asset.osFamily === "windows"
        );

        if (!hasRule) {
            gaps.push({
                assetIp: asset.ip,
                assetMac: asset.mac,
                gapType: payload.gapType || "missing-detection",
                description: `No deployed Sigma rule covers ${asset.ip} (${asset.hostname || "unknown host"})`
            });
        }
    }

    if (gaps.length && user) {
        for (const gap of gaps.slice(0, 3)) {
            await pushGrcGapFinding({
                title: `Detection gap on ${gap.assetIp}`,
                description: gap.description,
                asset: gap.assetIp,
                gapId: `${gap.assetIp}:${gap.gapType}`,
                gapType: gap.gapType
            }, user);
        }
    }

    return { gaps, coverage: coverage.coverageSummary };
};

export const deployRuleToSiem = async (rule, user) => {
    const index = process.env.UCTC_SIEM_INDEX || "lumisec-uctc-deployments";
    const target = rule.targetSiem || "elastic";

    const useMockDeployment =
        process.env.NODE_ENV === "test" ||
        (process.env.SIEM_DEPLOYMENT_MODE || "mock") === "mock";

    if (useMockDeployment) {
        return {
            deployed: true,
            mode: "mock",
            target,
            convertedRule: rule.convertedQueries?.get?.(target) || rule.convertedQuery || null
        };
    }

    const { conversions } = convertSigmaRuleToTargets(rule.rawSigma, [target]);
    const converted = conversions[target];

    const document = {
        eventType: "sigma_rule_deployed",
        ruleId: rule._id.toString(),
        ruleTitle: rule.title,
        targetSiem: rule.targetSiem,
        convertedRule: converted,
        deployedBy: user?._id,
        timestamp: new Date().toISOString()
    };

    const elkResult = await indexDocument(index, document);
    return { deployed: true, mode: "elastic", elkResult, index };
};

export const pullOpenCtiIocs = async (payload = {}) => {
    if (!process.env.OPENCTI_URL || !process.env.OPENCTI_TOKEN) {
        return { iocs: [], count: 0, mode: "unconfigured" };
    }

    try {
        const data = await getIOCs(payload.limit || 25);
        const edges = data?.indicators?.edges || [];
        return { iocs: edges.map((edge) => edge.node), count: edges.length };
    } catch {
        return { iocs: [], count: 0, mode: "unavailable" };
    }
};

export const pushSiemDeployEvent = async (payload) => {
    const index = process.env.UCTC_SIEM_INDEX || "lumisec-uctc-deployments";
    const document = {
        eventType: payload.eventType || "uctc_rule_deploy",
        ruleId: payload.ruleId,
        ruleTitle: payload.ruleTitle,
        targetSiem: payload.targetSiem,
        sourceModule: sourceModule.UCTC,
        metadata: payload.metadata || {},
        timestamp: new Date().toISOString()
    };

    const elkResult = await indexDocument(index, document);
    return { forwarded: true, index, elkResult };
};
