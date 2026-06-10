import Joi from "joi";
import { ruleStatus } from "../../utils/constant/enums.js";

const targets = ["elastic", "kql", "splunk", "spl", "sentinel", "azure"];
const sandboxLanguages = ["powershell", "python", "bash"];

const sigmaContentFields = {
    yaml_content: Joi.string().min(1),
    rawSigma: Joi.string().min(1)
};

export const validateRuleValidation = Joi.object({
    ...sigmaContentFields
}).or("yaml_content", "rawSigma");

export const convertRuleValidation = Joi.object({
    ...sigmaContentFields,
    targets: Joi.array().items(Joi.string().valid(...targets)).min(1),
    targetSiem: Joi.string().valid(...targets)
}).or("yaml_content", "rawSigma").or("targets", "targetSiem");

export const createRuleValidation = Joi.object({
    title: Joi.string().optional(),
    description: Joi.string().optional(),
    ...sigmaContentFields,
    targetSiem: Joi.string().valid(...targets).optional(),
    targets: Joi.array().items(Joi.string().valid(...targets)).optional(),
    mitreTactics: Joi.array().items(Joi.string()).optional(),
    mitreTechniques: Joi.array().items(Joi.string()).optional(),
    tags: Joi.array().items(Joi.string()).optional(),
    references: Joi.array().items(Joi.string().uri()).optional(),
    level: Joi.string().valid("informational", "low", "medium", "high", "critical").optional()
}).or("yaml_content", "rawSigma");

export const updateRuleValidation = Joi.object({
    ruleId: Joi.string().hex().length(24).required(),
    title: Joi.string().optional(),
    description: Joi.string().allow("").optional(),
    ...sigmaContentFields,
    targetSiem: Joi.string().valid(...targets).optional(),
    targets: Joi.array().items(Joi.string().valid(...targets)).optional(),
    mitreTactics: Joi.array().items(Joi.string()).optional(),
    mitreTechniques: Joi.array().items(Joi.string()).optional(),
    tags: Joi.array().items(Joi.string()).optional(),
    references: Joi.array().items(Joi.string().uri()).optional(),
    level: Joi.string().valid("informational", "low", "medium", "high", "critical").optional()
});

export const listRulesValidation = Joi.object({
    page: Joi.number().integer().min(1).optional(),
    limit: Joi.number().integer().min(1).max(100).optional(),
    status: Joi.string().valid(...Object.values(ruleStatus)).optional(),
    severity: Joi.string().valid("informational", "low", "medium", "high", "critical").optional(),
    targetSiem: Joi.string().valid(...targets).optional(),
    mitreTechnique: Joi.string().optional(),
    search: Joi.string().optional()
});

export const ruleIdValidation = Joi.object({
    ruleId: Joi.string().hex().length(24).required()
});

export const convertSavedRuleValidation = Joi.object({
    ruleId: Joi.string().hex().length(24).required(),
    targets: Joi.array().items(Joi.string().valid(...targets)).min(1),
    targetSiem: Joi.string().valid(...targets)
}).or("targets", "targetSiem");

export const updateStatusValidation = Joi.object({
    status: Joi.string().valid(...Object.values(ruleStatus)).required(),
    ruleId: Joi.string().hex().length(24).required()
});

export const executeScriptValidation = Joi.object({
    language: Joi.string().valid(...sandboxLanguages).required(),
    script: Joi.string().min(1).max(20000).required(),
    timeout: Joi.number().integer().min(1).max(120).optional()
});

export const executeScenarioValidation = Joi.object({
    scenario_id: Joi.string().required(),
    timeout: Joi.number().integer().min(1).max(120).optional()
});

export const listSandboxRunsValidation = Joi.object({
    page: Joi.number().integer().min(1).optional(),
    limit: Joi.number().integer().min(1).max(100).optional(),
    status: Joi.string().valid("queued", "running", "succeeded", "failed", "timed_out").optional(),
    type: Joi.string().valid("script", "scenario").optional(),
    scenarioId: Joi.string().optional()
});

export const noisyRulesValidation = Joi.object({
    page: Joi.number().integer().min(1).optional(),
    limit: Joi.number().integer().min(1).max(100).optional(),
    minFalsePositiveRate: Joi.number().min(0).max(1).optional()
});

export const tuningSuggestionsValidation = Joi.object({
    rule_id: Joi.string().hex().length(24).required()
});

export const applyTuningValidation = Joi.object({
    rule_id: Joi.string().hex().length(24).required(),
    exclusion_query: Joi.string().min(1).max(5000).required(),
    reason: Joi.string().max(1000).optional()
});

export const ingestAlertFeedbackValidation = Joi.object({
    rule_id: Joi.string().hex().length(24).required(),
    outcome: Joi.string().valid("true_positive", "false_positive").required(),
    count: Joi.number().integer().min(1).max(1000).optional(),
    estimated_minutes: Joi.number().min(0).max(10000).optional(),
    source: Joi.string().max(200).optional()
});
