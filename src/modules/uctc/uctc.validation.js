import Joi from "joi";
import { ruleStatus } from "../../utils/constant/enums.js";

export const createRuleValidation = Joi.object({
    title: Joi.string().required(),
    description: Joi.string().optional(),
    rawSigma: Joi.string().required(),
    targetSiem: Joi.string().valid("splunk", "elastic", "sentinel").required(),
    mitreTactics: Joi.array().items(Joi.string()).optional(),
    mitreTechniques: Joi.array().items(Joi.string()).optional()
});

export const updateStatusValidation = Joi.object({
    status: Joi.string().valid(...Object.values(ruleStatus)).required(),
    ruleId: Joi.string().hex().length(24).required()
});
