import { NetworkAsset, NetworkFlowMetric, NetworkMisconfiguration, SigmaRule } from "../../../database/index.js";
import { AppError } from "../../utils/appError.js";
import { successResponse, paginatedResponse } from "../../utils/apiResponse.js";
import { messages } from "../../utils/constant/messages.js";
import { ruleStatus } from "../../utils/constant/enums.js";
import {
    convertSigmaRuleToTargets,
    normalizeTargets,
    SigmaValidationError,
    validateSigmaRule
} from "../../utils/helpers/sigmaConverter.js";
import { buildNetworkDetectionSuggestions } from "../../utils/helpers/networkDetectionContext.js";
import * as uctcIntegration from "./services/integration.service.js";

/**
 * Reads Sigma YAML from either the documented field or the internal model field.
 */
const getSigmaContent = (body) => body.yaml_content || body.rawSigma;

/**
 * Normalizes requested SIEM targets and supports sending both targets and targetSiem.
 */
const getRequestedTargets = (body) => {
    const requestedTargets = [
        ...(Array.isArray(body.targets) ? body.targets : []),
        body.targetSiem
    ].filter(Boolean);

    return normalizeTargets(requestedTargets);
};

/**
 * Shapes validation results into a stable API response for the rule builder UI.
 */
const buildValidationResponse = (validation) => ({
    valid: validation.valid,
    errors: validation.errors,
    warnings: validation.warnings,
    metadata: validation.metadata
});

/**
 * Copies Sigma metadata and validation status onto a rule document.
 */
const applyValidationToRule = (rule, validation) => {
    // Store validation details so the UI can show precise rule-builder feedback later.
    rule.validation = {
        isValid: validation.valid,
        errors: validation.errors,
        warnings: validation.warnings,
        validatedAt: new Date()
    };

    if (!validation.valid) return;

    const metadata = validation.metadata;
    rule.parsedSigma = validation.parsedRule;
    rule.title = rule.title || metadata.title;
    rule.description = rule.description || metadata.description;
    rule.sigmaId = metadata.sigmaId;
    rule.logsource = metadata.logsource;
    rule.level = rule.level || metadata.level;
    rule.author = metadata.author;
    rule.references = rule.references?.length ? rule.references : metadata.references;
    rule.tags = rule.tags?.length ? rule.tags : metadata.tags;
    rule.mitreTactics = rule.mitreTactics?.length ? rule.mitreTactics : metadata.mitreTactics;
    rule.mitreTechniques = rule.mitreTechniques?.length ? rule.mitreTechniques : metadata.mitreTechniques;
    rule.status = ruleStatus.VALIDATED;
};

/**
 * Stores converted SIEM queries on both new and legacy rule fields.
 */
const applyConversionsToRule = (rule, conversionResult) => {
    // Keep both the new multi-target map and the old single convertedQuery field.
    rule.targets = conversionResult.targets;
    rule.targetSiem = conversionResult.targets[0];
    rule.convertedQueries = new Map(Object.entries(conversionResult.conversions));
    rule.convertedQuery = conversionResult.conversions[rule.targetSiem];
    rule.convertedAt = new Date();
    rule.status = ruleStatus.CONVERTED;
};

/**
 * Sends consistent 422 responses when Sigma YAML fails validation.
 */
const validationErrorResponse = (res, validation) => {
    return res.status(422).json({
        success: false,
        message: messages.sigmaRule.invalidSyntax,
        ...buildValidationResponse(validation)
    });
};

/**
 * Sends consistent 422 responses when conversion cannot safely produce a query.
 */
const conversionErrorResponse = (res, error) => {
    return res.status(422).json({
        success: false,
        message: error.message || messages.sigmaRule.conversionFailed,
        errors: error.details || [{ message: error.message }]
    });
};

/**
 * Runs Sigma conversion and converts known conversion errors into API responses.
 */
const convertOrRespond = (res, rawSigma, targets) => {
    try {
        return convertSigmaRuleToTargets(rawSigma, targets);
    } catch (error) {
        if (error instanceof SigmaValidationError) {
            conversionErrorResponse(res, error);
            return null;
        }
        throw error;
    }
};

/**
 * Validates a Sigma YAML document without saving it.
 * This supports the rule-builder screen where analysts need fast feedback.
 */
export const validateRule = async (req, res, next) => {
    const validation = validateSigmaRule(getSigmaContent(req.body));
    if (!validation.valid) return validationErrorResponse(res, validation);

    return successResponse(res, {
        message: "Sigma rule is valid",
        data: buildValidationResponse(validation)
    });
};

/**
 * Converts unsaved Sigma YAML into one or more SIEM query dialects.
 * Nothing is persisted here, so the frontend can preview conversion output.
 */
export const convertRule = async (req, res, next) => {
    const validation = validateSigmaRule(getSigmaContent(req.body));
    if (!validation.valid) return validationErrorResponse(res, validation);

    const conversionResult = convertOrRespond(res, getSigmaContent(req.body), getRequestedTargets(req.body));
    if (!conversionResult) return;

    return successResponse(res, {
        message: "Sigma rule converted successfully",
        data: {
            validation: buildValidationResponse(conversionResult.validation),
            targets: conversionResult.targets,
            conversions: conversionResult.conversions
        }
    });
};

/**
 * Uses LumiNet asset context to suggest UCTC detection-rule ideas.
 * This is the main context-sharing integration between LumiNet and UCTC.
 */
export const suggestRulesFromNetwork = async (req, res, next) => {
    const { ip } = req.body;
    const asset = await NetworkAsset.findOne({ ip });
    if (!asset) return next(new AppError("Network asset context not found", 404));

    const [misconfigurations, recentFlows] = await Promise.all([
        NetworkMisconfiguration.find({ asset: asset._id, status: "open" }).sort({ detectedAt: -1 }).limit(10),
        NetworkFlowMetric.find({ sourceIp: ip }).sort({ observedAt: -1 }).limit(10)
    ]);

    // INFRA/CLOUD INTEGRATION: This context can later come from a dedicated LumiNet service call instead of shared Mongo models.
    const suggestions = buildNetworkDetectionSuggestions({ asset, misconfigurations, recentFlows });

    return successResponse(res, {
        message: "Network-based detection suggestions generated",
        data: {
            asset,
            misconfigurations,
            recentFlows,
            suggestions
        }
    });
};

/**
 * Saves a validated Sigma rule and optionally stores converted queries.
 * This is the main persistence path for the UCTC rule-builder workflow.
 */
export const createRule = async (req, res, next) => {
    const {
        title,
        description,
        targetSiem,
        mitreTactics,
        mitreTechniques,
        tags,
        references,
        level
    } = req.body;
    const rawSigma = getSigmaContent(req.body);
    const createdBy = req.authUser._id;
    const validation = validateSigmaRule(rawSigma);
    if (!validation.valid) return validationErrorResponse(res, validation);

    const rule = new SigmaRule({
        title: title || validation.metadata.title,
        description: description || validation.metadata.description,
        rawSigma,
        targetSiem,
        mitreTactics,
        mitreTechniques,
        tags,
        references,
        level,
        createdBy
    });

    applyValidationToRule(rule, validation);

    const requestedTargets = getRequestedTargets(req.body);
    if (requestedTargets.length) {
        const conversionResult = convertOrRespond(res, rawSigma, requestedTargets);
        if (!conversionResult) return;
        applyConversionsToRule(rule, conversionResult);
    }

    await rule.save();

    return successResponse(res, { message: messages.sigmaRule.createdSuccessfully, data: rule, statusCode: 201 });
};

/**
 * Converts an already saved rule, usually after an analyst chooses new targets.
 */
export const convertSavedRule = async (req, res, next) => {
    const { ruleId } = req.params;
    const rule = await SigmaRule.findById(ruleId);
    if (!rule) return next(new AppError(messages.sigmaRule.notFound, 404));

    const conversionResult = convertOrRespond(res, rule.rawSigma, getRequestedTargets(req.body));
    if (!conversionResult) return;
    applyValidationToRule(rule, conversionResult.validation);
    applyConversionsToRule(rule, conversionResult);
    rule.updatedBy = req.authUser._id;
    await rule.save();

    return successResponse(res, {
        message: "Saved Sigma rule converted successfully",
        data: rule
    });
};

/**
 * Marks a converted rule as deployed.
 * Actual SIEM push integration is still separate because cloud/SIEM targets are not ready yet.
 */
export const deployRule = async (req, res, next) => {
    const { ruleId } = req.params;

    const rule = await SigmaRule.findById(ruleId);
    if (!rule) return next(new AppError(messages.sigmaRule.notFound, 404));
    if (rule.status !== ruleStatus.CONVERTED) {
        return next(new AppError("Rule must be converted before deployment", 400));
    }

    const deployment = await uctcIntegration.deployRuleToSiem(rule, req.authUser);
    rule.deploymentNote = deployment.mode === "mock"
        ? `Mock deployment recorded for ${rule.targetSiem}`
        : `Deployed to ${deployment.index || rule.targetSiem}`;
    rule.status = ruleStatus.DEPLOYED;
    rule.deployedAt = new Date();
    rule.approvedBy = req.authUser._id;
    await rule.save();

    await uctcIntegration.pushSiemDeployEvent({
        ruleId: rule._id.toString(),
        ruleTitle: rule.title,
        targetSiem: rule.targetSiem,
        metadata: deployment
    });

    return successResponse(res, { message: messages.sigmaRule.deployedSuccessfully, data: rule });
};

/**
 * Lists rules with the filters needed by the dashboard and rule archive.
 */
export const getRules = async (req, res, next) => {
    const { page = 1, limit = 20, status, severity, targetSiem, mitreTechnique, search } = req.query;
    const skip = (page - 1) * limit;
    const filter = {};
    if (status) filter.status = status;
    if (severity) filter.level = severity;
    if (targetSiem) filter.targets = normalizeTargets([targetSiem])[0] || targetSiem;
    if (mitreTechnique) filter.mitreTechniques = mitreTechnique.toUpperCase();
    if (search) filter.$text = { $search: search };

    const [rules, total] = await Promise.all([
        SigmaRule.find(filter).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)).populate("createdBy", "name email"),
        SigmaRule.countDocuments(filter)
    ]);

    return paginatedResponse(res, { message: "Rules fetched", data: rules, page: Number(page), limit: Number(limit), total });
};

/**
 * Fetches one complete rule document for detail screens and editing.
 */
export const getRuleById = async (req, res, next) => {
    const { ruleId } = req.params;
    const rule = await SigmaRule.findById(ruleId).populate("createdBy", "name email");
    if (!rule) return next(new AppError(messages.sigmaRule.notFound, 404));

    return successResponse(res, { message: "Rule fetched", data: rule });
};

/**
 * Updates editable rule metadata and optionally re-validates/re-converts YAML.
 */
export const updateRule = async (req, res, next) => {
    const { ruleId } = req.params;
    const rule = await SigmaRule.findById(ruleId);
    if (!rule) return next(new AppError(messages.sigmaRule.notFound, 404));
    if (rule.status === ruleStatus.DEPLOYED) {
        return next(new AppError("Deployed rules cannot be edited; archive and create a new revision", 400));
    }

    const editableFields = ["title", "description", "level", "references", "tags", "mitreTactics", "mitreTechniques"];
    for (const field of editableFields) {
        if (req.body[field] !== undefined) rule[field] = req.body[field];
    }

    const rawSigma = getSigmaContent(req.body);
    if (rawSigma) {
        const validation = validateSigmaRule(rawSigma);
        if (!validation.valid) return validationErrorResponse(res, validation);

        rule.rawSigma = rawSigma;
        rule.convertedQuery = undefined;
        rule.convertedQueries = new Map();
        rule.convertedAt = undefined;
        applyValidationToRule(rule, validation);
    }

    const requestedTargets = getRequestedTargets(req.body);
    if (requestedTargets.length) {
        const conversionResult = convertOrRespond(res, rule.rawSigma, requestedTargets);
        if (!conversionResult) return;
        applyConversionsToRule(rule, conversionResult);
    }

    rule.updatedBy = req.authUser._id;
    await rule.save();

    return successResponse(res, { message: messages.sigmaRule.updatedSuccessfully, data: rule });
};

/**
 * Archives a rule by moving it to the retired state while keeping history intact.
 */
export const archiveRule = async (req, res, next) => {
    const { ruleId } = req.params;
    const rule = await SigmaRule.findById(ruleId);
    if (!rule) return next(new AppError(messages.sigmaRule.notFound, 404));

    // Archive uses the existing RETIRED state from the original model vocabulary.
    rule.status = ruleStatus.RETIRED;
    rule.retiredAt = new Date();
    rule.updatedBy = req.authUser._id;
    await rule.save();

    return successResponse(res, { message: messages.sigmaRule.retiredSuccessfully, data: rule });
};

export const integrateGrcGap = async (req, res) => {
    const finding = await uctcIntegration.pushGrcGapFinding(req.body, req.authUser);
    return successResponse(res, { message: "GRC finding created from UCTC gap", data: finding, statusCode: 201 });
};

export const integrateSoarIncident = async (req, res) => {
    const incident = await uctcIntegration.pushSoarIncident(req.body, req.authUser);
    return successResponse(res, { message: "SOAR incident created from UCTC", data: incident, statusCode: 201 });
};

export const integrateNetworkCoverage = async (req, res) => {
    const result = await uctcIntegration.suggestRulesFromNetwork(req.body, req.authUser);
    return successResponse(res, { message: "Network coverage analysis completed", data: result });
};

export const integrateSiemDeploy = async (req, res) => {
    const rule = await SigmaRule.findById(req.body.ruleId);
    if (!rule) throw new AppError(messages.sigmaRule.notFound, 404);
    const deployment = await uctcIntegration.deployRuleToSiem(rule, req.authUser);
    await uctcIntegration.pushSiemDeployEvent({
        ruleId: rule._id.toString(),
        ruleTitle: rule.title,
        targetSiem: rule.targetSiem,
        metadata: deployment
    });
    return successResponse(res, { message: "Rule deployment forwarded to SIEM", data: deployment, statusCode: 202 });
};

export const integrateOpenCtiIoc = async (req, res) => {
    const result = await uctcIntegration.pullOpenCtiIocs(req.body);
    return successResponse(res, { message: "OpenCTI IOCs retrieved", data: result });
};
