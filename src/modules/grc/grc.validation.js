import Joi from "joi";
import {
    findingStatus, sourceModule, severity, riskLevel, riskStatus, riskTreatment,
    taskStatus, taskPriority, complianceFramework, controlStatus, retestResult
} from "../../utils/constant/enums.js";

const objectId = Joi.string().hex().length(24);
const pagination = {
    page: Joi.number().integer().min(1).optional(),
    limit: Joi.number().integer().min(1).max(100).optional(),
    sort: Joi.string().optional(),
    search: Joi.string().optional()
};

export const createFindingValidation = Joi.object({
    title: Joi.string().required(),
    description: Joi.string().required(),
    severity: Joi.string().valid(...Object.values(severity)).required(),
    riskRating: Joi.string().valid(...Object.values(riskLevel)).required(),
    sourceModule: Joi.string().valid(...Object.values(sourceModule)).optional(),
    sourceId: Joi.string().optional(),
    asset: Joi.string().optional(),
    assignedTo: objectId.optional(),
    dueDate: Joi.date().optional(),
    tags: Joi.array().items(Joi.string()).optional(),
    control: Joi.string().optional(),
    auditReportId: objectId.optional()
});

export const updateFindingValidation = Joi.object({
    id: objectId.required(),
    title: Joi.string().optional(),
    description: Joi.string().optional(),
    severity: Joi.string().valid(...Object.values(severity)).optional(),
    riskRating: Joi.string().valid(...Object.values(riskLevel)).optional(),
    asset: Joi.string().optional(),
    status: Joi.string().valid(...Object.values(findingStatus)).optional(),
    dueDate: Joi.date().optional(),
    tags: Joi.array().items(Joi.string()).optional()
});

export const assignFindingValidation = Joi.object({
    id: objectId.required(),
    assignedTo: objectId.required()
});

export const listFindingsValidation = Joi.object({
    ...pagination,
    severity: Joi.string().valid(...Object.values(severity)).optional(),
    status: Joi.string().valid(...Object.values(findingStatus)).optional(),
    asset: Joi.string().optional(),
    sourceModule: Joi.string().valid(...Object.values(sourceModule)).optional(),
    riskRating: Joi.string().valid(...Object.values(riskLevel)).optional(),
    assignedTo: objectId.optional()
});

export const findingIdValidation = Joi.object({ id: objectId.required() });

export const createRiskValidation = Joi.object({
    findingId: objectId.optional(),
    title: Joi.string().required(),
    description: Joi.string().required(),
    likelihood: Joi.number().integer().min(1).max(5).required(),
    impact: Joi.number().integer().min(1).max(5).required(),
    treatment: Joi.string().valid(...Object.values(riskTreatment)).optional(),
    owner: objectId.optional()
});

export const updateRiskValidation = Joi.object({
    id: objectId.required(),
    title: Joi.string().optional(),
    description: Joi.string().optional(),
    likelihood: Joi.number().integer().min(1).max(5).optional(),
    impact: Joi.number().integer().min(1).max(5).optional(),
    treatment: Joi.string().valid(...Object.values(riskTreatment)).optional(),
    status: Joi.string().valid(...Object.values(riskStatus)).optional(),
    owner: objectId.optional()
});

export const listRisksValidation = Joi.object({
    ...pagination,
    status: Joi.string().valid(...Object.values(riskStatus)).optional(),
    riskLevel: Joi.string().valid(...Object.values(riskLevel)).optional(),
    owner: objectId.optional(),
    findingId: objectId.optional()
});

export const riskIdValidation = Joi.object({ id: objectId.required() });

export const createTaskValidation = Joi.object({
    findingId: objectId.required(),
    title: Joi.string().required(),
    description: Joi.string().required(),
    assignedTo: objectId.required(),
    dueDate: Joi.date().optional(),
    priority: Joi.string().valid(...Object.values(taskPriority)).optional()
});

export const updateTaskValidation = Joi.object({
    id: objectId.required(),
    title: Joi.string().optional(),
    description: Joi.string().optional(),
    assignedTo: objectId.optional(),
    dueDate: Joi.date().optional(),
    priority: Joi.string().valid(...Object.values(taskPriority)).optional(),
    status: Joi.string().valid(...Object.values(taskStatus)).optional()
});

export const listTasksValidation = Joi.object({
    ...pagination,
    status: Joi.string().valid(...Object.values(taskStatus)).optional(),
    priority: Joi.string().valid(...Object.values(taskPriority)).optional(),
    assignedTo: objectId.optional(),
    findingId: objectId.optional()
});

export const taskIdValidation = Joi.object({ id: objectId.required() });

export const createEvidenceValidation = Joi.object({
    findingId: objectId.required(),
    taskId: objectId.optional()
});

export const evidenceIdValidation = Joi.object({ id: objectId.required() });

export const createReportValidation = Joi.object({
    title: Joi.string().required(),
    framework: Joi.string().valid(...Object.values(complianceFramework)).required(),
    scope: Joi.string().optional(),
    summary: Joi.string().optional(),
    findings: Joi.array().items(objectId).optional()
});

export const updateReportValidation = Joi.object({
    id: objectId.required(),
    title: Joi.string().optional(),
    scope: Joi.string().optional(),
    summary: Joi.string().optional(),
    status: Joi.string().valid("draft", "generating", "ready", "published").optional()
});

export const addReportFindingsValidation = Joi.object({
    id: objectId.required(),
    findingIds: Joi.array().items(objectId).min(1).required()
});

export const reportIdValidation = Joi.object({ id: objectId.required() });

export const createControlValidation = Joi.object({
    framework: Joi.string().valid(...Object.values(complianceFramework)).required(),
    controlId: Joi.string().required(),
    title: Joi.string().required(),
    description: Joi.string().optional(),
    status: Joi.string().valid(...Object.values(controlStatus)).optional()
});

export const updateControlValidation = Joi.object({
    id: objectId.required(),
    title: Joi.string().optional(),
    description: Joi.string().optional(),
    status: Joi.string().valid(...Object.values(controlStatus)).optional()
});

export const linkControlFindingValidation = Joi.object({
    id: objectId.required(),
    findingId: objectId.required()
});

export const listControlsValidation = Joi.object({
    ...pagination,
    framework: Joi.string().valid(...Object.values(complianceFramework)).optional(),
    status: Joi.string().valid(...Object.values(controlStatus)).optional()
});

export const controlIdValidation = Joi.object({ id: objectId.required() });

export const createRetestValidation = Joi.object({
    id: objectId.required(),
    result: Joi.string().valid(...Object.values(retestResult)).required(),
    notes: Joi.string().optional()
});

export const listAuditLogsValidation = Joi.object({
    ...pagination,
    action: Joi.string().optional(),
    entityType: Joi.string().optional(),
    user: objectId.optional()
});

export const entityAuditValidation = Joi.object({
    entityType: Joi.string().required(),
    entityId: objectId.required()
});

export const listNotificationsValidation = Joi.object({
    ...pagination,
    isRead: Joi.string().valid("true", "false").optional()
});

export const notificationIdValidation = Joi.object({ id: objectId.required() });

export const networkFindingValidation = Joi.object({
    title: Joi.string().required(),
    description: Joi.string().required(),
    severity: Joi.string().valid(...Object.values(severity)).required(),
    riskRating: Joi.string().valid(...Object.values(riskLevel)).optional(),
    asset: Joi.string().optional(),
    sourceId: Joi.string().optional(),
    findingType: Joi.string().optional(),
    tags: Joi.array().items(Joi.string()).optional(),
    assignedTo: objectId.optional()
});

export const uctcFindingValidation = Joi.object({
    title: Joi.string().required(),
    description: Joi.string().required(),
    severity: Joi.string().valid(...Object.values(severity)).required(),
    riskRating: Joi.string().valid(...Object.values(riskLevel)).optional(),
    asset: Joi.string().optional(),
    testCaseId: Joi.string().optional(),
    sourceId: Joi.string().optional(),
    tags: Joi.array().items(Joi.string()).optional()
});

export const soarIncidentValidation = Joi.object({
    incidentId: Joi.string().required(),
    title: Joi.string().optional(),
    description: Joi.string().required(),
    severity: Joi.string().valid(...Object.values(severity)).optional(),
    riskRating: Joi.string().valid(...Object.values(riskLevel)).optional(),
    createRisk: Joi.boolean().optional(),
    likelihood: Joi.number().integer().min(1).max(5).optional(),
    impact: Joi.number().integer().min(1).max(5).optional()
});

export const soarTaskUpdateValidation = Joi.object({
    id: objectId.required(),
    status: Joi.string().valid(...Object.values(taskStatus)).optional(),
    description: Joi.string().optional(),
    priority: Joi.string().valid(...Object.values(taskPriority)).optional()
});

export const phishingRiskValidation = Joi.object({
    title: Joi.string().optional(),
    description: Joi.string().optional(),
    eventType: Joi.string().valid("click", "submit").required(),
    sourceId: Joi.string().optional(),
    severity: Joi.string().valid(...Object.values(severity)).optional(),
    owner: objectId.optional(),
    findingId: objectId.optional()
});

export const siemAlertValidation = Joi.object({
    alertId: Joi.string().required(),
    ruleName: Joi.string().required(),
    severity: Joi.string().valid(...Object.values(severity)).required(),
    sourceIp: Joi.string().optional(),
    destinationIp: Joi.string().optional(),
    indexName: Joi.string().optional(),
    receivedAt: Joi.date().optional()
});

export const openctiIocValidation = Joi.object({
    title: Joi.string().optional(),
    description: Joi.string().optional(),
    indicator: Joi.string().required(),
    iocType: Joi.string().valid("ip", "domain", "hash", "malware", "url").required(),
    confidence: Joi.number().integer().min(1).max(5).optional(),
    owner: objectId.optional()
});
