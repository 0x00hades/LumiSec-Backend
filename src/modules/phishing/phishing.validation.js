import Joi from "joi";
import {
    campaignStatus, phishingEventType, phishingRiskLevel, recipientStatus
} from "../../utils/constant/enums.js";

const objectId = Joi.string().hex().length(24);

export const createTemplateValidation = Joi.object({
    name: Joi.string().min(2).max(120).required(),
    subject: Joi.string().required(),
    htmlBody: Joi.string().required(),
    textBody: Joi.string().optional(),
    category: Joi.string().optional(),
    language: Joi.string().default("en")
});

export const updateTemplateValidation = createTemplateValidation.fork(
    ["name", "subject", "htmlBody"],
    (schema) => schema.optional()
);

export const templateIdValidation = Joi.object({
    id: objectId.required()
});

export const createLandingPageValidation = Joi.object({
    name: Joi.string().min(2).max(120).required(),
    title: Joi.string().required(),
    htmlContent: Joi.string().required(),
    redirectUrl: Joi.string().uri().optional()
});

export const updateLandingPageValidation = createLandingPageValidation.fork(
    ["name", "title", "htmlContent"],
    (schema) => schema.optional()
);

export const landingPageIdValidation = Joi.object({
    id: objectId.required()
});

export const importRecipientsValidation = Joi.object({
    campaignId: objectId.optional(),
    csv: Joi.string().optional(),
    recipients: Joi.array().items(Joi.object({
        fullName: Joi.string().empty("").optional(),
        email: Joi.string().email().required(),
        department: Joi.string().empty("").optional(),
        jobTitle: Joi.string().empty("").optional(),
        manager: Joi.string().empty("").optional()
    })).optional()
}).or("csv", "recipients");

export const recipientIdValidation = Joi.object({
    id: objectId.required()
});

export const updateRecipientValidation = Joi.object({
    fullName: Joi.string().optional(),
    email: Joi.string().email().optional(),
    department: Joi.string().optional(),
    jobTitle: Joi.string().optional(),
    manager: Joi.string().optional(),
    status: Joi.string().valid(...Object.values(recipientStatus)).optional()
});

export const listRecipientsValidation = Joi.object({
    page: Joi.number().integer().min(1).optional(),
    limit: Joi.number().integer().min(1).max(100).optional(),
    campaignId: objectId.optional(),
    email: Joi.string().email().optional()
});

export const createCampaignValidation = Joi.object({
    name: Joi.string().min(2).max(120).required(),
    description: Joi.string().optional(),
    templateId: objectId.required(),
    landingPageId: objectId.optional(),
    launchDate: Joi.date().optional(),
    trackingDomain: Joi.string().uri().optional(),
    status: Joi.string().valid(campaignStatus.DRAFT, campaignStatus.SCHEDULED).optional()
});

export const updateCampaignValidation = Joi.object({
    name: Joi.string().min(2).max(120).optional(),
    description: Joi.string().optional(),
    templateId: objectId.optional(),
    landingPageId: objectId.optional(),
    launchDate: Joi.date().optional(),
    trackingDomain: Joi.string().uri().optional(),
    status: Joi.string().valid(...Object.values(campaignStatus)).optional()
});

export const campaignIdValidation = Joi.object({
    id: objectId.required()
});

export const campaignIdParamValidation = Joi.object({
    campaignId: objectId.required()
});

export const addCampaignRecipientsValidation = Joi.object({
    recipients: Joi.array().items(Joi.object({
        fullName: Joi.string().empty("").optional(),
        email: Joi.string().email().required(),
        department: Joi.string().empty("").optional(),
        jobTitle: Joi.string().empty("").optional(),
        manager: Joi.string().empty("").optional()
    })).min(1).required()
});

export const launchCampaignValidation = Joi.object({
    trackingDomain: Joi.string().uri().optional()
});

export const trackingIdParamValidation = Joi.object({
    trackingId: Joi.string().min(8).required()
});

export const trackSubmitValidation = Joi.object({
    trackingId: Joi.string().min(8).required(),
    username: Joi.string().required(),
    password: Joi.forbidden()
});

export const trackDownloadValidation = Joi.object({
    trackingId: Joi.string().min(8).required(),
    attachment: Joi.string().optional()
});

export const grcRiskIntegrationValidation = Joi.object({
    title: Joi.string().optional(),
    description: Joi.string().optional(),
    eventType: Joi.string().required(),
    campaignId: objectId.optional(),
    recipientId: objectId.optional(),
    findingId: objectId.optional(),
    owner: objectId.optional()
});

export const soarIncidentIntegrationValidation = Joi.object({
    title: Joi.string().optional(),
    description: Joi.string().optional(),
    eventType: Joi.string().required(),
    campaignId: objectId.required(),
    sourceIp: Joi.string().optional(),
    severity: Joi.string().optional()
});

export const siemEventIntegrationValidation = Joi.object({
    eventType: Joi.string().valid(...Object.values(phishingEventType)).required(),
    campaignId: objectId.required(),
    recipientId: objectId.required(),
    sourceIp: Joi.string().optional(),
    userAgent: Joi.string().optional(),
    metadata: Joi.object().optional()
});

export const openctiIndicatorValidation = Joi.object({
    name: Joi.string().optional(),
    value: Joi.string().required(),
    pattern: Joi.string().optional(),
    observableType: Joi.string().optional()
});

export const listQueryValidation = Joi.object({
    page: Joi.number().integer().min(1).optional(),
    limit: Joi.number().integer().min(1).max(100).optional(),
    sort: Joi.string().optional()
});

export const dashboardTrendsValidation = Joi.object({
    days: Joi.number().integer().min(1).max(365).default(30)
});

export const listEventsValidation = Joi.object({
    page: Joi.number().integer().min(1).optional(),
    limit: Joi.number().integer().min(1).max(100).optional(),
    campaignId: objectId.optional(),
    eventType: Joi.string().valid(...Object.values(phishingEventType)).optional()
});
