import { SandboxRun, SigmaRule, UctcTuning } from "../../../database/index.js";
import { AppError } from "../../utils/appError.js";
import { successResponse, paginatedResponse } from "../../utils/apiResponse.js";
import { ruleStatus, sandboxRunStatus } from "../../utils/constant/enums.js";

/**
 * Calculates the current false-positive rate from stored analyst feedback.
 */
const calculateFalsePositiveRate = (rule) => {
    const totalAlerts = rule.tuning?.totalAlerts || 0;
    const falsePositiveCount = rule.tuning?.falsePositiveCount || 0;
    if (!totalAlerts) return rule.falsePositiveRate || 0;
    return falsePositiveCount / totalAlerts;
};

/**
 * Builds lightweight tuning suggestions from rule metadata and noise evidence.
 */
const buildTuningSuggestions = (rule) => {
    const suggestions = [];
    const falsePositiveRate = calculateFalsePositiveRate(rule);

    if (falsePositiveRate >= 0.5) {
        suggestions.push({
            type: "allowlist",
            title: "Add known benign user or host exclusion",
            exclusionQuery: 'user.name NOT IN ("svc_backup", "svc_monitoring")',
            reason: "Rule has a high false-positive rate; start by excluding approved service accounts."
        });
    }

    if (rule.logsource?.category === "process_creation") {
        suggestions.push({
            type: "process_filter",
            title: "Filter trusted administrative paths",
            exclusionQuery: 'process.executable NOT LIKE "C:\\\\Program Files\\\\TrustedTools\\\\%"',
            reason: "Process creation rules often need trusted-tool path filtering."
        });
    }

    if (!rule.mitreTechniques?.length) {
        suggestions.push({
            type: "metadata",
            title: "Add MITRE ATT&CK technique tags",
            exclusionQuery: "",
            reason: "MITRE tags improve coverage reporting and dashboard grouping."
        });
    }

    if (!suggestions.length) {
        suggestions.push({
            type: "review",
            title: "Review recent alerts before applying exclusions",
            exclusionQuery: "",
            reason: "This rule does not have enough noisy-rule evidence for an automatic exclusion suggestion."
        });
    }

    return suggestions;
};

/**
 * Restores the previous useful lifecycle state after a noisy rule is tuned.
 */
const getStatusAfterTuning = (rule) => {
    if (rule.status !== ruleStatus.NOISY) return rule.status;
    return rule.deployedAt ? ruleStatus.DEPLOYED : ruleStatus.CONVERTED;
};

/**
 * Lists noisy rules based on false-positive rate and existing tuning stats.
 */
export const getNoisyRules = async (req, res, next) => {
    const { page = 1, limit = 20, minFalsePositiveRate = 0.4 } = req.query;
    const skip = (page - 1) * limit;

    const allRules = await SigmaRule.find({ status: { $ne: ruleStatus.RETIRED } }).sort({ updatedAt: -1 });
    const noisyRules = allRules
        .map((rule) => ({
            rule,
            falsePositiveRate: calculateFalsePositiveRate(rule),
            totalAlerts: rule.tuning?.totalAlerts || 0,
            estimatedMinutesWasted: rule.tuning?.estimatedMinutesWasted || 0
        }))
        .filter((item) => item.rule.status === ruleStatus.NOISY || item.falsePositiveRate >= Number(minFalsePositiveRate));

    const data = noisyRules.slice(skip, skip + Number(limit));

    return paginatedResponse(res, {
        message: "Noisy rules fetched",
        data,
        page: Number(page),
        limit: Number(limit),
        total: noisyRules.length
    });
};

/**
 * Generates tuning suggestions for one rule from stored rule metadata.
 */
export const getTuningSuggestions = async (req, res, next) => {
    const { rule_id } = req.query;
    const rule = await SigmaRule.findById(rule_id);
    if (!rule) return next(new AppError("Sigma rule not found", 404));

    return successResponse(res, {
        message: "Tuning suggestions fetched",
        data: {
            ruleId: rule._id,
            falsePositiveRate: calculateFalsePositiveRate(rule),
            suggestions: buildTuningSuggestions(rule)
        }
    });
};

/**
 * Stores an exclusion/tuning decision and attaches it to the rule history.
 */
export const applyTuning = async (req, res, next) => {
    const { rule_id, exclusion_query, reason } = req.body;
    const rule = await SigmaRule.findById(rule_id);
    if (!rule) return next(new AppError("Sigma rule not found", 404));

    const tuning = await UctcTuning.create({
        rule: rule._id,
        exclusionQuery: exclusion_query,
        reason,
        appliedBy: req.authUser._id
    });

    if (!rule.tuning) rule.tuning = {};
    if (!rule.tuning.exclusions) rule.tuning.exclusions = [];

    rule.tuning.exclusions.push({
        query: exclusion_query,
        reason,
        appliedBy: req.authUser._id,
        appliedAt: new Date()
    });

    // INFRA/CLOUD INTEGRATION: Push this exclusion to Elastic/Splunk/Sentinel when SIEM cloud access is ready.
    rule.status = getStatusAfterTuning(rule);
    await rule.save();

    return successResponse(res, {
        message: "Tuning exclusion applied",
        data: { tuning, rule }
    });
};

/**
 * Ingests analyst alert feedback so noisy-rule and dashboard metrics have real data.
 */
export const ingestAlertFeedback = async (req, res, next) => {
    const { rule_id, outcome, count = 1, estimated_minutes = 5, source } = req.body;
    const rule = await SigmaRule.findById(rule_id);
    if (!rule) return next(new AppError("Sigma rule not found", 404));

    if (!rule.tuning) rule.tuning = {};

    // INFRA/CLOUD INTEGRATION: SIEM alert webhooks can call this endpoint after mapping their alert rule ID to rule_id.
    const totalAlerts = rule.tuning.totalAlerts || 0;
    const falsePositiveCount = rule.tuning.falsePositiveCount || 0;
    const truePositiveCount = rule.tuning.truePositiveCount || 0;
    const estimatedMinutesWasted = rule.tuning.estimatedMinutesWasted || 0;

    rule.tuning.totalAlerts = totalAlerts + count;
    rule.tuning.falsePositiveCount = outcome === "false_positive" ? falsePositiveCount + count : falsePositiveCount;
    rule.tuning.truePositiveCount = outcome === "true_positive" ? truePositiveCount + count : truePositiveCount;
    rule.tuning.estimatedMinutesWasted = outcome === "false_positive"
        ? estimatedMinutesWasted + (count * estimated_minutes)
        : estimatedMinutesWasted;

    rule.falsePositiveRate = calculateFalsePositiveRate(rule);
    rule.lastAlertAt = new Date();

    if (rule.falsePositiveRate >= 0.4 && rule.tuning.totalAlerts >= 5 && rule.status !== ruleStatus.RETIRED) {
        rule.status = ruleStatus.NOISY;
    }

    await rule.save();

    return successResponse(res, {
        message: "Alert feedback ingested",
        data: {
            ruleId: rule._id,
            source,
            outcome,
            count,
            falsePositiveRate: rule.falsePositiveRate,
            tuning: rule.tuning,
            status: rule.status
        }
    });
};

/**
 * Returns compact UCTC metrics for the dashboard.
 */
export const getDashboardStats = async (req, res, next) => {
    const [
        totalRules,
        convertedRules,
        deployedRules,
        noisyRules,
        retiredRules,
        successfulRuns,
        failedRuns,
        recentRules,
        recentRuns
    ] = await Promise.all([
        SigmaRule.countDocuments(),
        SigmaRule.countDocuments({ status: ruleStatus.CONVERTED }),
        SigmaRule.countDocuments({ status: ruleStatus.DEPLOYED }),
        SigmaRule.countDocuments({ status: ruleStatus.NOISY }),
        SigmaRule.countDocuments({ status: ruleStatus.RETIRED }),
        SandboxRun.countDocuments({ status: sandboxRunStatus.SUCCEEDED }),
        SandboxRun.countDocuments({ status: { $in: [sandboxRunStatus.FAILED, sandboxRunStatus.TIMED_OUT] } }),
        SigmaRule.find().sort({ createdAt: -1 }).limit(5).select("title status level targets createdAt"),
        SandboxRun.find().sort({ createdAt: -1 }).limit(5).select("type status language scenarioId durationMs createdAt")
    ]);

    // INFRA/CLOUD INTEGRATION: Replace mock health with real Elastic/Splunk/Sentinel and cloud runner probes later.
    const serviceHealth = {
        api: "ok",
        sandboxMode: process.env.UCTC_SANDBOX_MODE || "mock",
        siemDeploymentMode: process.env.SIEM_DEPLOYMENT_MODE || "mock"
    };

    return successResponse(res, {
        message: "UCTC dashboard stats fetched",
        data: {
            rules: {
                total: totalRules,
                converted: convertedRules,
                deployed: deployedRules,
                noisy: noisyRules,
                retired: retiredRules
            },
            sandbox: {
                successfulRuns,
                failedRuns
            },
            recentRules,
            recentRuns,
            serviceHealth
        }
    });
};
