import Joi from "joi";
import { incidentSeverity } from "../../utils/constant/enums.js";

export const createIncidentValidation = Joi.object({
    title: Joi.string().required(),
    description: Joi.string().optional(),
    severity: Joi.string().valid(...Object.values(incidentSeverity)).required(),
    sourceIP: Joi.string().ip().optional(),
    affectedHost: Joi.string().optional(),
    playbookId: Joi.string().hex().length(24).optional()
});

export const createPlaybookValidation = Joi.object({
    name: Joi.string().required(),
    description: Joi.string().optional(),
    triggerType: Joi.string().valid("manual", "auto").default("manual"),
    triggerCondition: Joi.string().optional(),
    actions: Joi.array().items(
        Joi.object({
            type: Joi.string().valid("block_ip", "isolate_host", "enrich", "notify", "ssh_command").required(),
            params: Joi.object().optional(),
            order: Joi.number().required()
        })
    ).min(1).required()
});
