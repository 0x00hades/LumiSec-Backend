import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import Joi from "joi";
import {
    Framework,
    FrameworkRequirement,
    UnifiedControl,
    RequirementControlMapping
} from "../../../../database/index.js";
import { AppError } from "../../../utils/appError.js";
import { logger } from "../../../utils/logger.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_FRAMEWORKS_DIR = path.resolve(__dirname, "../../../../grc_frameworks");

const CONTROL_TEXT_PATTERN = /\[([A-Z][A-Z0-9.-]*)\]:\s*([^|]+)/g;

const requirementRecordSchema = Joi.object({
    framework: Joi.string().required(),
    version: Joi.string().required(),
    requirement_id: Joi.alternatives().try(Joi.string(), Joi.number()).required(),
    domain: Joi.string().allow("", null),
    control_text: Joi.string().allow("", null),
    sub_requirements: Joi.array().items(Joi.string()).default([]),
    evidence_mapping: Joi.object({
        siem_events: Joi.array().items(Joi.string()).default([]),
        tools: Joi.array().items(Joi.string()).default([])
    }).default({}),
    weight: Joi.number().default(0),
    compliance_threshold: Joi.number().default(0),
    maturity_level: Joi.string().allow("", null)
}).unknown(true);

const deriveCategory = (controlCode) => {
    const match = controlCode.match(/^([A-Z]+)/);
    return match ? match[1] : "GENERAL";
};

const buildTitle = (description, controlCode) => {
    if (!description) return controlCode;
    const firstSentence = description.split(/\.(?:\s|$)/)[0].trim();
    if (firstSentence.length <= 120) return firstSentence;
    return `${firstSentence.slice(0, 117)}...`;
};

export const extractControlDescriptions = (controlText) => {
    const descriptions = new Map();
    if (!controlText) return descriptions;

    let match;
    while ((match = CONTROL_TEXT_PATTERN.exec(controlText)) !== null) {
        const code = match[1].trim().toUpperCase();
        const description = match[2].trim();
        const existing = descriptions.get(code);
        if (!existing || description.length > existing.length) {
            descriptions.set(code, description);
        }
    }

    return descriptions;
};

export const detectStructure = (payload, sourceFile) => {
    let records = payload;

    if (payload && !Array.isArray(payload) && Array.isArray(payload.requirements)) {
        records = payload.requirements;
    }

    if (!Array.isArray(records)) {
        throw new AppError(`Unsupported JSON structure in ${sourceFile}: expected an array of requirements`, 422);
    }

    if (records.length === 0) {
        throw new AppError(`No requirements found in ${sourceFile}`, 422);
    }

    const normalized = [];
    const errors = [];

    records.forEach((record, index) => {
        const { error, value } = requirementRecordSchema.validate(record, { abortEarly: false });
        if (error) {
            errors.push({ index, details: error.details.map((d) => d.message) });
            return;
        }

        normalized.push({
            framework: value.framework.trim(),
            version: String(value.version).trim(),
            requirementId: String(value.requirement_id).trim(),
            domain: value.domain?.trim() || "",
            controlText: value.control_text?.trim() || "",
            subRequirements: (value.sub_requirements || []).map((code) => String(code).trim().toUpperCase()).filter(Boolean),
            evidenceMapping: {
                siemEvents: value.evidence_mapping?.siem_events || [],
                tools: value.evidence_mapping?.tools || []
            },
            weight: value.weight ?? 0,
            complianceThreshold: value.compliance_threshold ?? 0,
            maturityLevel: value.maturity_level?.trim() || ""
        });
    });

    if (errors.length) {
        throw new AppError(
            `Validation failed for ${sourceFile}: ${errors.length} invalid record(s)`,
            422
        );
    }

    return normalized;
};

export const scanFrameworkFiles = async (frameworksDir = DEFAULT_FRAMEWORKS_DIR) => {
    const entries = await fs.readdir(frameworksDir);
    return entries
        .filter((file) => file.endsWith(".json"))
        .map((file) => path.join(frameworksDir, file))
        .sort();
};

const loadFrameworkFiles = async (frameworksDir) => {
    const files = await scanFrameworkFiles(frameworksDir);
    if (!files.length) {
        throw new AppError(`No framework JSON files found in ${frameworksDir}`, 404);
    }

    const parsedFiles = [];

    for (const filePath of files) {
        const raw = await fs.readFile(filePath, "utf8");
        const payload = JSON.parse(raw);
        const requirements = detectStructure(payload, path.basename(filePath));

        parsedFiles.push({
            sourceFile: path.basename(filePath),
            filePath,
            requirements
        });
    }

    return parsedFiles;
};

const upsertFrameworks = async (parsedFiles) => {
    const frameworkMap = new Map();

    for (const file of parsedFiles) {
        const grouped = new Map();

        for (const req of file.requirements) {
            const key = `${req.framework}::${req.version}`;
            if (!grouped.has(key)) grouped.set(key, []);
            grouped.get(key).push(req);
        }

        for (const [key, requirements] of grouped) {
            if (frameworkMap.has(key)) continue;

            const [name, version] = key.split("::");
            const domains = [...new Set(requirements.map((r) => r.domain).filter(Boolean))];

            frameworkMap.set(key, {
                name,
                version,
                description: `${name} compliance framework (version ${version})`,
                metadata: {
                    sourceFile: file.sourceFile,
                    domains,
                    requirementCount: requirements.length
                }
            });
        }
    }

    const stats = { imported: 0, skipped: 0, frameworks: new Map() };
    const operations = [];

    for (const [key, frameworkDoc] of frameworkMap) {
        operations.push({
            updateOne: {
                filter: { name: frameworkDoc.name, version: frameworkDoc.version },
                update: {
                    $set: {
                        description: frameworkDoc.description,
                        metadata: frameworkDoc.metadata
                    },
                    $setOnInsert: {
                        name: frameworkDoc.name,
                        version: frameworkDoc.version
                    }
                },
                upsert: true
            }
        });
    }

    if (operations.length) {
        const result = await Framework.bulkWrite(operations, { ordered: false });
        stats.imported = result.upsertedCount;
        stats.skipped = (result.matchedCount || 0) - (result.upsertedCount || 0);
    }

    const storedFrameworks = await Framework.find({
        $or: [...frameworkMap.values()].map((f) => ({ name: f.name, version: f.version }))
    });

    for (const framework of storedFrameworks) {
        stats.frameworks.set(`${framework.name}::${framework.version}`, framework);
    }

    return stats;
};

const upsertRequirements = async (parsedFiles, frameworkLookup) => {
    const stats = { imported: 0, skipped: 0, requirements: new Map() };
    const operations = [];
    const requirementKeys = [];

    for (const file of parsedFiles) {
        for (const req of file.requirements) {
            const frameworkKey = `${req.framework}::${req.version}`;
            const framework = frameworkLookup.get(frameworkKey);
            if (!framework) continue;

            const compositeKey = `${framework._id}::${req.requirementId}`;
            requirementKeys.push(compositeKey);

            operations.push({
                updateOne: {
                    filter: { frameworkId: framework._id, requirementId: req.requirementId },
                    update: {
                        $set: {
                            domain: req.domain,
                            controlText: req.controlText,
                            weight: req.weight,
                            complianceThreshold: req.complianceThreshold,
                            maturityLevel: req.maturityLevel,
                            evidenceMapping: req.evidenceMapping
                        },
                        $setOnInsert: {
                            frameworkId: framework._id,
                            requirementId: req.requirementId
                        }
                    },
                    upsert: true
                }
            });
        }
    }

    if (operations.length) {
        const batchSize = 500;
        for (let i = 0; i < operations.length; i += batchSize) {
            const batch = operations.slice(i, i + batchSize);
            const result = await FrameworkRequirement.bulkWrite(batch, { ordered: false });
            stats.imported += result.upsertedCount;
            stats.skipped += (result.matchedCount || 0) - (result.upsertedCount || 0);
        }
    }

    const storedRequirements = await FrameworkRequirement.find({
        $or: requirementKeys.map((key) => {
            const [frameworkId, requirementId] = key.split("::");
            return { frameworkId, requirementId };
        })
    });

    for (const requirement of storedRequirements) {
        stats.requirements.set(
            `${requirement.frameworkId}::${requirement.requirementId}`,
            requirement
        );
    }

    return stats;
};

const buildUnifiedControlCatalog = (parsedFiles) => {
    const catalog = new Map();

    for (const file of parsedFiles) {
        for (const req of file.requirements) {
            const descriptions = extractControlDescriptions(req.controlText);

            for (const code of req.subRequirements) {
                const description = descriptions.get(code) || "";
                const existing = catalog.get(code);

                if (!existing || description.length > existing.description.length) {
                    catalog.set(code, {
                        controlCode: code,
                        title: buildTitle(description, code),
                        description,
                        category: deriveCategory(code)
                    });
                }
            }
        }
    }

    return catalog;
};

const upsertUnifiedControls = async (catalog) => {
    const stats = { imported: 0, skipped: 0, controls: new Map() };
    const operations = [];

    for (const control of catalog.values()) {
        operations.push({
            updateOne: {
                filter: { controlCode: control.controlCode },
                update: {
                    $set: {
                        title: control.title,
                        description: control.description,
                        category: control.category
                    },
                    $setOnInsert: { controlCode: control.controlCode }
                },
                upsert: true
            }
        });
    }

    if (operations.length) {
        const batchSize = 500;
        for (let i = 0; i < operations.length; i += batchSize) {
            const batch = operations.slice(i, i + batchSize);
            const result = await UnifiedControl.bulkWrite(batch, { ordered: false });
            stats.imported += result.upsertedCount;
            stats.skipped += (result.matchedCount || 0) - (result.upsertedCount || 0);
        }
    }

    const controlCodes = [...catalog.keys()];
    const storedControls = await UnifiedControl.find({ controlCode: { $in: controlCodes } });

    for (const control of storedControls) {
        stats.controls.set(control.controlCode, control);
    }

    return stats;
};

const upsertMappings = async (parsedFiles, frameworkLookup, requirementLookup, controlLookup) => {
    const stats = { imported: 0, skipped: 0 };
    const operations = [];
    const seen = new Set();

    for (const file of parsedFiles) {
        for (const req of file.requirements) {
            const frameworkKey = `${req.framework}::${req.version}`;
            const framework = frameworkLookup.get(frameworkKey);
            if (!framework) continue;

            const requirementKey = `${framework._id}::${req.requirementId}`;
            const requirement = requirementLookup.get(requirementKey);
            if (!requirement) continue;

            for (const code of req.subRequirements) {
                const control = controlLookup.get(code);
                if (!control) continue;

                const mappingKey = `${requirement._id}::${control._id}`;
                if (seen.has(mappingKey)) continue;
                seen.add(mappingKey);

                operations.push({
                    updateOne: {
                        filter: { requirementId: requirement._id, controlId: control._id },
                        update: {
                            $setOnInsert: {
                                requirementId: requirement._id,
                                controlId: control._id
                            }
                        },
                        upsert: true
                    }
                });
            }
        }
    }

    if (operations.length) {
        const batchSize = 1000;
        for (let i = 0; i < operations.length; i += batchSize) {
            const batch = operations.slice(i, i + batchSize);
            const result = await RequirementControlMapping.bulkWrite(batch, { ordered: false });
            stats.imported += result.upsertedCount;
            stats.skipped += (result.matchedCount || 0) - (result.upsertedCount || 0);
        }
    }

    return stats;
};

export const importFrameworks = async ({
    frameworksDir = DEFAULT_FRAMEWORKS_DIR,
    dryRun = false
} = {}) => {
    logger.info("Starting framework import", { frameworksDir, dryRun });

    const parsedFiles = await loadFrameworkFiles(frameworksDir);
    const totalSourceRequirements = parsedFiles.reduce((sum, file) => sum + file.requirements.length, 0);

    if (dryRun) {
        const catalog = buildUnifiedControlCatalog(parsedFiles);
        const frameworkNames = new Set();

        for (const file of parsedFiles) {
            for (const req of file.requirements) {
                frameworkNames.add(`${req.framework} (${req.version})`);
            }
        }

        return {
            dryRun: true,
            filesScanned: parsedFiles.length,
            frameworksDetected: frameworkNames.size,
            requirementsDetected: totalSourceRequirements,
            controlsDetected: catalog.size,
            frameworks: [...frameworkNames]
        };
    }

    const frameworkStats = await upsertFrameworks(parsedFiles);
    const requirementStats = await upsertRequirements(parsedFiles, frameworkStats.frameworks);
    const controlCatalog = buildUnifiedControlCatalog(parsedFiles);
    const controlStats = await upsertUnifiedControls(controlCatalog);
    const mappingStats = await upsertMappings(
        parsedFiles,
        frameworkStats.frameworks,
        requirementStats.requirements,
        controlStats.controls
    );

    const summary = {
        filesScanned: parsedFiles.length,
        frameworks: {
            imported: frameworkStats.imported,
            skipped: frameworkStats.skipped,
            total: frameworkStats.frameworks.size
        },
        requirements: {
            imported: requirementStats.imported,
            skipped: requirementStats.skipped,
            total: requirementStats.requirements.size
        },
        controls: {
            imported: controlStats.imported,
            skipped: controlStats.skipped,
            total: controlStats.controls.size
        },
        mappings: {
            imported: mappingStats.imported,
            skipped: mappingStats.skipped,
            total: mappingStats.imported + mappingStats.skipped
        }
    };

    logger.info("Framework import completed", summary);
    return summary;
};
