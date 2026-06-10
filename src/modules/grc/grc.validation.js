import Joi from "joi";

export const createFindingValidation = Joi.object({
    title: Joi.string().required(),
    description: Joi.string().required(),
    riskRating: Joi.string().valid("low", "medium", "high", "critical").required(),
    severity: Joi.number().min(1).max(10).optional(),
    control: Joi.string().optional(),
    auditReportId: Joi.string().hex().length(24).optional()
});

export const createTaskValidation = Joi.object({
    findingId: Joi.string().hex().length(24).required(),
    assigneeId: Joi.string().hex().length(24).required(),
    description: Joi.string().required(),
    dueDate: Joi.date().optional()
});
