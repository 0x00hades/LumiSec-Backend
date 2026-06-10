import dotenv from "dotenv";
import { connectDB } from "../../database/connection.js";
import { SigmaRule } from "../../database/index.js";
import { logger } from "../utils/logger.js";
import { ruleQueue } from "../utils/queue.js";
import { ruleStatus } from "../utils/constant/enums.js";
import {
    convertSigmaRuleToTargets,
    normalizeTargets,
    validateSigmaRule
} from "../utils/helpers/sigmaConverter.js";

dotenv.config({ path: "./config/.env" });

await connectDB();

ruleQueue.process("convertSigmaRule", async (job) => {
    const { ruleId, rawSigma, targetSiem, targets } = job.data;
    const rule = await SigmaRule.findById(ruleId);
    if (!rule) throw new Error(`Sigma rule not found: ${ruleId}`);

    // The worker repeats validation because queued data may be stale or edited.
    const validation = validateSigmaRule(rawSigma || rule.rawSigma);
    rule.validation = {
        isValid: validation.valid,
        errors: validation.errors,
        warnings: validation.warnings,
        validatedAt: new Date()
    };

    if (!validation.valid) {
        rule.status = ruleStatus.DRAFT;
        await rule.save();
        return { converted: false, errors: validation.errors };
    }

    const requestedTargets = normalizeTargets(targets || [targetSiem || rule.targetSiem].filter(Boolean));
    const conversionResult = convertSigmaRuleToTargets(rawSigma || rule.rawSigma, requestedTargets);

    rule.parsedSigma = conversionResult.validation.parsedRule;
    rule.targets = conversionResult.targets;
    rule.targetSiem = conversionResult.targets[0];
    rule.convertedQueries = new Map(Object.entries(conversionResult.conversions));
    rule.convertedQuery = conversionResult.conversions[rule.targetSiem];
    rule.convertedAt = new Date();
    rule.status = ruleStatus.CONVERTED;
    await rule.save();

    logger.info(`Sigma rule converted: ${ruleId}`);
    return { converted: true, ruleId, targets: conversionResult.targets };
});

logger.info("Rule worker started");
