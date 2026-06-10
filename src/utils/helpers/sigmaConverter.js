import yaml from "js-yaml";

const SUPPORTED_TARGETS = {
    elastic: "elastic",
    kql: "elastic",
    splunk: "splunk",
    spl: "splunk",
    sentinel: "sentinel",
    azure: "sentinel"
};

const REQUIRED_SIGMA_FIELDS = ["title", "logsource", "detection"];

/**
 * Error type used when Sigma content cannot be parsed or converted safely.
 * Controllers can read `details` to return precise validation feedback.
 */
export class SigmaValidationError extends Error {
    constructor(message, details = []) {
        super(message);
        this.name = "SigmaValidationError";
        this.details = details;
    }
}

/**
 * Returns the canonical target names used by the backend.
 * This keeps the API friendly while storing predictable values in MongoDB.
 */
export const normalizeTargets = (targets = []) => {
    const normalized = targets
        .map((target) => SUPPORTED_TARGETS[String(target).toLowerCase()])
        .filter(Boolean);

    return [...new Set(normalized)];
};

/**
 * Parses Sigma YAML into a JavaScript object and adds source-location details
 * when YAML syntax is invalid.
 */
export const parseSigmaYaml = (yamlContent = "") => {
    try {
        const parsed = yaml.load(yamlContent);
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
            throw new SigmaValidationError("Sigma YAML must describe one rule object");
        }
        return parsed;
    } catch (error) {
        if (error instanceof SigmaValidationError) throw error;

        const mark = error.mark || {};
        throw new SigmaValidationError("Invalid Sigma YAML syntax", [{
            message: error.reason || error.message,
            line: Number.isInteger(mark.line) ? mark.line + 1 : undefined,
            column: Number.isInteger(mark.column) ? mark.column + 1 : undefined
        }]);
    }
};

/**
 * Extracts the fields the rest of UCTC needs from a parsed Sigma rule.
 * The raw parsed rule is still stored separately for future advanced features.
 */
export const normalizeSigmaMetadata = (parsedRule) => {
    const tags = Array.isArray(parsedRule.tags) ? parsedRule.tags : [];
    const mitreTechniques = tags
        .filter((tag) => /^attack\.t\d{4}/i.test(tag))
        .map((tag) => tag.replace(/^attack\./i, "").toUpperCase());
    const mitreTactics = tags
        .filter((tag) => /^attack\.[a-z][a-z_-]+$/i.test(tag))
        .map((tag) => tag.replace(/^attack\./i, "").replace(/_/g, "-"));

    return {
        title: parsedRule.title,
        sigmaId: parsedRule.id,
        description: parsedRule.description,
        author: parsedRule.author,
        status: parsedRule.status,
        level: parsedRule.level,
        references: Array.isArray(parsedRule.references) ? parsedRule.references : [],
        tags,
        mitreTactics,
        mitreTechniques,
        logsource: parsedRule.logsource || {}
    };
};

/**
 * Validates Sigma structure beyond YAML syntax.
 * This is intentionally conservative: it catches missing contract fields while
 * allowing uncommon Sigma extensions to pass through for later conversion work.
 */
export const validateSigmaRule = (yamlContent = "") => {
    const errors = [];
    const warnings = [];
    let parsedRule;

    try {
        parsedRule = parseSigmaYaml(yamlContent);
    } catch (error) {
        return {
            valid: false,
            errors: error.details?.length ? error.details : [{ message: error.message }],
            warnings,
            parsedRule: null,
            metadata: null
        };
    }

    for (const field of REQUIRED_SIGMA_FIELDS) {
        if (!parsedRule[field]) {
            errors.push({ path: field, message: `Missing required Sigma field: ${field}` });
        }
    }

    if (parsedRule.logsource && (typeof parsedRule.logsource !== "object" || Array.isArray(parsedRule.logsource))) {
        errors.push({ path: "logsource", message: "Logsource must be an object" });
    }

    if (parsedRule.detection && typeof parsedRule.detection === "object") {
        const detectionKeys = Object.keys(parsedRule.detection).filter((key) => key !== "condition");
        if (!parsedRule.detection.condition) {
            errors.push({ path: "detection.condition", message: "Missing detection condition" });
        }
        if (!detectionKeys.length) {
            errors.push({ path: "detection", message: "Detection must contain at least one selection" });
        }
    } else if (parsedRule.detection) {
        errors.push({ path: "detection", message: "Detection must be an object" });
    }

    if (!parsedRule.level) {
        warnings.push({ path: "level", message: "Rule has no severity level; default UI severity may be used" });
    }

    const tags = Array.isArray(parsedRule.tags) ? parsedRule.tags : [];
    if (parsedRule.tags && !Array.isArray(parsedRule.tags)) {
        warnings.push({ path: "tags", message: "Tags should be an array" });
    }

    if (!tags.some((tag) => /^attack\./i.test(tag))) {
        warnings.push({ path: "tags", message: "No MITRE ATT&CK tags found" });
    }

    return {
        valid: errors.length === 0,
        errors,
        warnings,
        parsedRule,
        metadata: normalizeSigmaMetadata(parsedRule)
    };
};

/**
 * Converts one parsed Sigma rule into all requested SIEM query languages.
 * Unsupported Sigma condition shapes produce a clear validation error instead
 * of returning a misleading partial query.
 */
export const convertSigmaRuleToTargets = (yamlContent = "", targets = []) => {
    const normalizedTargets = normalizeTargets(targets);
    if (!normalizedTargets.length) {
        throw new SigmaValidationError("At least one supported conversion target is required", [{
            path: "targets",
            message: "Supported targets are elastic/kql, splunk/spl, and sentinel/azure"
        }]);
    }

    const validation = validateSigmaRule(yamlContent);
    if (!validation.valid) {
        throw new SigmaValidationError("Sigma rule is not valid", validation.errors);
    }

    const conversions = {};
    for (const target of normalizedTargets) {
        conversions[target] = convertParsedRule(validation.parsedRule, target);
    }

    return { validation, conversions, targets: normalizedTargets };
};

/**
 * Converts all named Sigma detections, then applies the rule condition.
 */
const convertParsedRule = (parsedRule, target) => {
    const { detection } = parsedRule;
    const namedExpressions = {};

    for (const [name, value] of Object.entries(detection)) {
        if (name === "condition") continue;
        namedExpressions[name] = buildSelectionExpression(value, target);
    }

    return buildConditionExpression(detection.condition, namedExpressions);
};

/**
 * Converts the Sigma condition string into a SIEM boolean expression.
 */
const buildConditionExpression = (condition, namedExpressions) => {
    const trimmed = String(condition).trim();

    if (/^all of them$/i.test(trimmed)) {
        return joinExpressions(Object.values(namedExpressions), "AND");
    }

    if (/^(1|any) of them$/i.test(trimmed)) {
        return joinExpressions(Object.values(namedExpressions), "OR");
    }

    let expression = trimmed.replace(/\b(all|1|any) of ([A-Za-z0-9_*]+)\b/gi, (_, amount, pattern) => {
        const matched = matchSelectionPattern(pattern, namedExpressions);
        return joinExpressions(matched, /^all$/i.test(amount) ? "AND" : "OR");
    });

    const names = Object.keys(namedExpressions).sort((a, b) => b.length - a.length);
    for (const name of names) {
        expression = expression.replace(new RegExp(`\\b${escapeRegExp(name)}\\b`, "g"), `(${namedExpressions[name]})`);
    }

    expression = expression
        .replace(/\band\b/gi, "AND")
        .replace(/\bor\b/gi, "OR")
        .replace(/\bnot\b/gi, "NOT");

    const unresolvedNames = Object.keys(namedExpressions).filter((name) => {
        const namePattern = new RegExp(`\\b${escapeRegExp(name)}\\b`);
        return namePattern.test(expression);
    });

    if (unresolvedNames.length) {
        throw new SigmaValidationError("Unsupported Sigma condition expression", [{
            path: "detection.condition",
            message: `Could not fully convert condition: ${condition}`
        }]);
    }

    return expression;
};

/**
 * Expands Sigma patterns like "all of selection_*" into matching selections.
 */
const matchSelectionPattern = (pattern, namedExpressions) => {
    if (pattern === "*") return Object.values(namedExpressions);
    const prefix = pattern.replace(/\*$/, "");
    return Object.entries(namedExpressions)
        .filter(([name]) => pattern.endsWith("*") ? name.startsWith(prefix) : name === pattern)
        .map(([, expression]) => expression);
};

/**
 * Converts a Sigma selection object or selection array into a query expression.
 */
const buildSelectionExpression = (selection, target) => {
    if (Array.isArray(selection)) {
        return joinExpressions(selection.map((item) => buildSelectionExpression(item, target)), "OR");
    }

    if (selection && typeof selection === "object") {
        const fieldExpressions = Object.entries(selection)
            .map(([field, value]) => buildFieldExpression(field, value, target));
        return joinExpressions(fieldExpressions, "AND");
    }

    throw new SigmaValidationError("Unsupported Sigma selection value", [{
        path: "detection",
        message: "Selections must be objects or arrays of objects"
    }]);
};

/**
 * Converts one Sigma field/modifier/value condition into the requested SIEM syntax.
 */
const buildFieldExpression = (rawField, value, target) => {
    const [field, ...modifiers] = rawField.split("|");
    const modifier = modifiers[0] || "equals";

    if (Array.isArray(value)) {
        return joinExpressions(value.map((singleValue) => buildFieldExpression(rawField, singleValue, target)), "OR");
    }

    if (value === null) {
        return buildNullExpression(field, target);
    }

    const stringValue = String(value);
    switch (target) {
        case "elastic":
            return buildElasticExpression(field, stringValue, modifier);
        case "splunk":
            return buildSplunkExpression(field, stringValue, modifier);
        case "sentinel":
            return buildSentinelExpression(field, stringValue, modifier);
        default:
            throw new SigmaValidationError(`Unsupported conversion target: ${target}`);
    }
};

/**
 * Builds a basic Elastic/KQL field expression for the supported Sigma modifiers.
 */
const buildElasticExpression = (field, value, modifier) => {
    const escaped = escapeQueryValue(value);
    if (modifier === "contains") return `${field}: "*${escaped}*"`;
    if (modifier === "startswith") return `${field}: "${escaped}*"`;
    if (modifier === "endswith") return `${field}: "*${escaped}"`;
    return `${field}: "${escaped}"`;
};

/**
 * Builds a basic Splunk SPL field expression for the supported Sigma modifiers.
 */
const buildSplunkExpression = (field, value, modifier) => {
    const escaped = escapeQueryValue(value);
    if (modifier === "contains") return `${field}="*${escaped}*"`;
    if (modifier === "startswith") return `${field}="${escaped}*"`;
    if (modifier === "endswith") return `${field}="*${escaped}"`;
    return `${field}="${escaped}"`;
};

/**
 * Builds a basic Microsoft Sentinel/KQL field expression for the supported Sigma modifiers.
 */
const buildSentinelExpression = (field, value, modifier) => {
    const escaped = escapeQueryValue(value);
    if (modifier === "contains") return `${field} contains "${escaped}"`;
    if (modifier === "startswith") return `${field} startswith "${escaped}"`;
    if (modifier === "endswith") return `${field} endswith "${escaped}"`;
    return `${field} == "${escaped}"`;
};

/**
 * Converts null checks into the closest supported query syntax for each SIEM.
 */
const buildNullExpression = (field, target) => {
    if (target === "elastic") return `NOT ${field}: *`;
    if (target === "splunk") return `NOT ${field}=*`;
    return `isnull(${field})`;
};

/**
 * Joins child expressions with AND/OR and rejects empty condition matches.
 */
const joinExpressions = (expressions, operator) => {
    const cleanExpressions = expressions.filter(Boolean);
    if (!cleanExpressions.length) {
        throw new SigmaValidationError("No Sigma selections matched the requested condition");
    }
    if (cleanExpressions.length === 1) return cleanExpressions[0];
    return cleanExpressions.map((expression) => `(${expression})`).join(` ${operator} `);
};

/**
 * Escapes query values before injecting them into generated SIEM query strings.
 */
const escapeQueryValue = (value) => value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');

/**
 * Escapes selection names before building regular expressions around them.
 */
const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
