import Joi from "joi";

export const createCampaignValidation = Joi.object({
    name: Joi.string().required(),
    description: Joi.string().optional(),
    template: Joi.object({
        subject: Joi.string().required(),
        senderName: Joi.string().required(),
        senderEmail: Joi.string().email().required(),
        htmlBody: Joi.string().required()
    }).required(),
    landingPageUrl: Joi.string().uri().optional(),
    trackingDomain: Joi.string().uri().optional()
});

export const trackEventValidation = Joi.object({
    trackingId: Joi.string().required(),
    type: Joi.string().valid("open", "click", "submit").required()
});
