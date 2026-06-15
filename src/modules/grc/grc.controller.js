import { successResponse, paginatedResponse } from "../../utils/apiResponse.js";
import { AppError } from "../../utils/appError.js";
import { messages } from "../../utils/constant/messages.js";
import * as findingService from "./services/finding.service.js";
import * as riskService from "./services/risk.service.js";
import * as taskService from "./services/task.service.js";
import * as evidenceService from "./services/evidence.service.js";
import * as reportService from "./services/report.service.js";
import * as complianceService from "./services/compliance.service.js";
import * as retestService from "./services/retest.service.js";
import * as dashboardService from "./services/dashboard.service.js";
import * as auditService from "./services/audit.service.js";
import * as notificationService from "./services/notification.service.js";
import * as integrationService from "./services/integration.service.js";

// ─── Findings ────────────────────────────────────────────────────────────────
export const createFinding = async (req, res) => {
    const finding = await findingService.createFinding(req.body, req.authUser);
    return successResponse(res, { message: messages.finding.createdSuccessfully, data: finding, statusCode: 201 });
};

export const getFindings = async (req, res) => {
    const result = await findingService.listFindings(req.query);
    return paginatedResponse(res, { message: "Findings fetched", ...result });
};

export const getFinding = async (req, res) => {
    const finding = await findingService.getFindingById(req.params.id);
    return successResponse(res, { message: "Finding fetched", data: finding });
};

export const updateFinding = async (req, res) => {
    const finding = await findingService.updateFinding(req.params.id, req.body, req.authUser);
    return successResponse(res, { message: messages.finding.updatedSuccessfully, data: finding });
};

export const assignFinding = async (req, res) => {
    const finding = await findingService.assignFinding(req.params.id, req.body.assignedTo, req.authUser);
    return successResponse(res, { message: messages.finding.assignedSuccessfully, data: finding });
};

export const closeFinding = async (req, res) => {
    const finding = await findingService.closeFinding(req.params.id, req.authUser);
    return successResponse(res, { message: messages.finding.closedSuccessfully, data: finding });
};

export const reopenFinding = async (req, res) => {
    const finding = await findingService.reopenFinding(req.params.id, req.authUser);
    return successResponse(res, { message: messages.finding.reopenedSuccessfully, data: finding });
};

export const deleteFinding = async (req, res) => {
    await findingService.deleteFinding(req.params.id, req.authUser);
    return successResponse(res, { message: messages.finding.deletedSuccessfully, data: null });
};

export const getFindingHistory = async (req, res) => {
    const history = await findingService.getFindingHistory(req.params.id);
    return successResponse(res, { message: messages.finding.historyFetched, data: history });
};

// ─── Risks ───────────────────────────────────────────────────────────────────
export const createRisk = async (req, res) => {
    const risk = await riskService.createRisk(req.body, req.authUser);
    return successResponse(res, { message: messages.risk.createdSuccessfully, data: risk, statusCode: 201 });
};

export const getRisks = async (req, res) => {
    const result = await riskService.listRisks(req.query);
    return paginatedResponse(res, { message: "Risks fetched", ...result });
};

export const getRisk = async (req, res) => {
    const risk = await riskService.getRiskById(req.params.id);
    return successResponse(res, { message: "Risk fetched", data: risk });
};

export const updateRisk = async (req, res) => {
    const risk = await riskService.updateRisk(req.params.id, req.body, req.authUser);
    return successResponse(res, { message: messages.risk.updatedSuccessfully, data: risk });
};

export const acceptRisk = async (req, res) => {
    const risk = await riskService.acceptRisk(req.params.id, req.authUser);
    return successResponse(res, { message: messages.risk.acceptedSuccessfully, data: risk });
};

export const mitigateRisk = async (req, res) => {
    const risk = await riskService.mitigateRisk(req.params.id, req.authUser);
    return successResponse(res, { message: messages.risk.mitigatedSuccessfully, data: risk });
};

export const closeRisk = async (req, res) => {
    const risk = await riskService.closeRisk(req.params.id, req.authUser);
    return successResponse(res, { message: messages.risk.closedSuccessfully, data: risk });
};

// ─── Tasks ───────────────────────────────────────────────────────────────────
export const createRemediationTask = async (req, res) => {
    const task = await taskService.createTask(req.body, req.authUser);
    return successResponse(res, { message: messages.task.createdSuccessfully, data: task, statusCode: 201 });
};

export const getTasks = async (req, res) => {
    const result = await taskService.listTasks(req.query);
    return paginatedResponse(res, { message: "Tasks fetched", ...result });
};

export const getTask = async (req, res) => {
    const task = await taskService.getTaskById(req.params.id);
    return successResponse(res, { message: "Task fetched", data: task });
};

export const updateTask = async (req, res) => {
    const task = await taskService.updateTask(req.params.id, req.body, req.authUser);
    return successResponse(res, { message: messages.task.updatedSuccessfully, data: task });
};

export const completeTask = async (req, res) => {
    const task = await taskService.completeTask(req.params.id, req.authUser);
    return successResponse(res, { message: messages.task.completedSuccessfully, data: task });
};

export const verifyTask = async (req, res) => {
    const task = await taskService.verifyTask(req.params.id, req.authUser);
    return successResponse(res, { message: messages.task.verifiedSuccessfully, data: task });
};

// ─── Evidence ──────────────────────────────────────────────────────────────────
export const uploadEvidence = async (req, res) => {
    if (!req.file) throw new AppError("Evidence file is required", 400);
    const evidence = await evidenceService.createEvidence({
        findingId: req.body.findingId,
        taskId: req.body.taskId,
        file: req.file,
        user: req.authUser
    });
    return successResponse(res, { message: messages.evidence.uploadedSuccessfully, data: evidence, statusCode: 201 });
};

export const getEvidence = async (req, res) => {
    const evidence = await evidenceService.getEvidenceById(req.params.id);
    return successResponse(res, { message: "Evidence fetched", data: evidence });
};

export const deleteEvidence = async (req, res) => {
    await evidenceService.deleteEvidence(req.params.id, req.authUser);
    return successResponse(res, { message: messages.evidence.deletedSuccessfully, data: null });
};

// ─── Reports ─────────────────────────────────────────────────────────────────
export const createReport = async (req, res) => {
    const report = await reportService.createReport(req.body, req.authUser);
    return successResponse(res, { message: messages.report.createdSuccessfully, data: report, statusCode: 201 });
};

export const getReports = async (req, res) => {
    const result = await reportService.listReports(req.query);
    return paginatedResponse(res, { message: "Reports fetched", ...result });
};

export const getReport = async (req, res) => {
    const report = await reportService.getReportById(req.params.id);
    return successResponse(res, { message: "Report fetched", data: report });
};

export const updateReport = async (req, res) => {
    const report = await reportService.updateReport(req.params.id, req.body, req.authUser);
    return successResponse(res, { message: messages.report.updatedSuccessfully, data: report });
};

export const deleteReport = async (req, res) => {
    await reportService.deleteReport(req.params.id, req.authUser);
    return successResponse(res, { message: messages.report.deletedSuccessfully, data: null });
};

export const addReportFindings = async (req, res) => {
    const report = await reportService.addFindingsToReport(req.params.id, req.body.findingIds, req.authUser);
    return successResponse(res, { message: "Findings added to report", data: report });
};

export const generateReport = async (req, res) => {
    const report = await reportService.generateReportPdf(req.params.id, req.authUser);
    return successResponse(res, { message: messages.report.generateQueued, data: report });
};

export const downloadReport = async (req, res) => {
    const { path: filePath, filename } = await reportService.getReportDownloadPath(req.params.id);
    return res.download(filePath, filename);
};

// ─── Compliance ──────────────────────────────────────────────────────────────
export const createControl = async (req, res) => {
    const control = await complianceService.createControl(req.body, req.authUser);
    return successResponse(res, { message: messages.compliance.createdSuccessfully, data: control, statusCode: 201 });
};

export const getControls = async (req, res) => {
    const result = await complianceService.listControls(req.query);
    return paginatedResponse(res, { message: "Controls fetched", ...result });
};

export const getControl = async (req, res) => {
    const control = await complianceService.getControlById(req.params.id);
    return successResponse(res, { message: "Control fetched", data: control });
};

export const updateControl = async (req, res) => {
    const control = await complianceService.updateControl(req.params.id, req.body, req.authUser);
    return successResponse(res, { message: messages.compliance.updatedSuccessfully, data: control });
};

export const linkControlFinding = async (req, res) => {
    const control = await complianceService.linkFindingToControl(req.params.id, req.body.findingId, req.authUser);
    return successResponse(res, { message: messages.compliance.linkedSuccessfully, data: control });
};

export const getComplianceStatus = async (req, res) => {
    const status = await complianceService.getComplianceStatus();
    return successResponse(res, { message: "Compliance status fetched", data: status });
};

// ─── Retests ───────────────────────────────────────────────────────────────────
export const createRetest = async (req, res) => {
    const result = await retestService.createRetest(req.params.id, req.body, req.authUser);
    return successResponse(res, { message: messages.retest.createdSuccessfully, data: result, statusCode: 201 });
};

export const getRetests = async (req, res) => {
    const retests = await retestService.listRetests(req.params.id);
    return successResponse(res, { message: messages.retest.listFetched, data: retests });
};

// ─── Dashboard ───────────────────────────────────────────────────────────────
export const getDashboardOverview = async (req, res) => {
    const data = await dashboardService.getOverview();
    return successResponse(res, { message: "Dashboard overview fetched", data });
};

export const getDashboardRisks = async (req, res) => {
    const data = await dashboardService.getRiskDashboard();
    return successResponse(res, { message: "Risk dashboard fetched", data });
};

export const getDashboardCompliance = async (req, res) => {
    const data = await dashboardService.getComplianceDashboard();
    return successResponse(res, { message: "Compliance dashboard fetched", data });
};

export const getDashboardTasks = async (req, res) => {
    const data = await dashboardService.getTasksDashboard();
    return successResponse(res, { message: "Tasks dashboard fetched", data });
};

export const getRiskHeatmap = async (req, res) => {
    const data = await dashboardService.getRiskHeatmap();
    return successResponse(res, { message: "Risk heatmap fetched", data });
};

// ─── Audit Logs ──────────────────────────────────────────────────────────────
export const getAuditLogs = async (req, res) => {
    const result = await auditService.listAuditLogs(req.query);
    return paginatedResponse(res, { message: "Audit logs fetched", ...result });
};

export const getEntityAuditLogs = async (req, res) => {
    const logs = await auditService.getEntityAuditLogs(req.params.entityType, req.params.entityId);
    return successResponse(res, { message: "Entity audit logs fetched", data: logs });
};

// ─── Notifications ───────────────────────────────────────────────────────────
export const getNotifications = async (req, res) => {
    const result = await notificationService.listNotifications(req.authUser._id, req.query);
    return paginatedResponse(res, { message: "Notifications fetched", ...result });
};

export const markNotificationRead = async (req, res) => {
    const notification = await notificationService.markNotificationRead(req.params.id, req.authUser._id);
    return successResponse(res, { message: messages.notification.markedRead, data: notification });
};

// ─── Integrations ────────────────────────────────────────────────────────────
export const ingestNetworkFinding = async (req, res) => {
    const finding = await integrationService.ingestNetworkFinding(req.body, req.authUser);
    return successResponse(res, { message: messages.integration.ingestedSuccessfully, data: finding, statusCode: 201 });
};

export const ingestUctcFinding = async (req, res) => {
    const finding = await integrationService.ingestUctcFinding(req.body, req.authUser);
    return successResponse(res, { message: messages.integration.ingestedSuccessfully, data: finding, statusCode: 201 });
};

export const ingestSoarIncident = async (req, res) => {
    const result = await integrationService.ingestSoarIncident(req.body, req.authUser);
    return successResponse(res, { message: messages.integration.ingestedSuccessfully, data: result, statusCode: 201 });
};

export const updateSoarTask = async (req, res) => {
    const task = await integrationService.updateSoarTask(req.params.id, req.body, req.authUser);
    return successResponse(res, { message: messages.task.updatedSuccessfully, data: task });
};

export const ingestPhishingRisk = async (req, res) => {
    const result = await integrationService.ingestPhishingRisk(req.body, req.authUser);
    return successResponse(res, { message: messages.integration.ingestedSuccessfully, data: result, statusCode: 201 });
};

export const ingestSiemAlert = async (req, res) => {
    const result = await integrationService.ingestSiemAlert(req.body, req.authUser);
    return successResponse(res, { message: messages.integration.ingestedSuccessfully, data: result, statusCode: 201 });
};

export const ingestOpenCtiIoc = async (req, res) => {
    const result = await integrationService.ingestOpenCtiIoc(req.body, req.authUser);
    return successResponse(res, { message: messages.integration.ingestedSuccessfully, data: result, statusCode: 201 });
};
