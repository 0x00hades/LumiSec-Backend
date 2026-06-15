import { Router } from "express";
import { isValid } from "../../middleware/validation.js";
import { asyncHandler } from "../../middleware/asyncHandler.js";
import { isAuthenticated } from "../../middleware/authentication.js";
import { isServiceOrUserAuthenticated } from "../../middleware/serviceAuth.js";
import { isAuthorized } from "../../middleware/authorization.js";
import { evidenceUpload } from "../../middleware/upload.js";
import { grcPermissions as p } from "./permissions.js";
import {
    createFindingValidation, updateFindingValidation, assignFindingValidation,
    listFindingsValidation, findingIdValidation, createRiskValidation, updateRiskValidation,
    listRisksValidation, riskIdValidation, createTaskValidation, updateTaskValidation,
    listTasksValidation, taskIdValidation, createEvidenceValidation, evidenceIdValidation,
    createReportValidation, updateReportValidation, addReportFindingsValidation, reportIdValidation,
    createControlValidation, updateControlValidation, linkControlFindingValidation,
    listControlsValidation, controlIdValidation, createRetestValidation,
    listAuditLogsValidation, entityAuditValidation, listNotificationsValidation,
    notificationIdValidation, networkFindingValidation, uctcFindingValidation,
    soarIncidentValidation, soarTaskUpdateValidation, phishingRiskValidation,
    siemAlertValidation, openctiIocValidation
} from "./grc.validation.js";
import {
    createFinding, getFindings, getFinding, updateFinding, assignFinding,
    closeFinding, reopenFinding, deleteFinding, getFindingHistory,
    createRisk, getRisks, getRisk, updateRisk, acceptRisk, mitigateRisk, closeRisk,
    createRemediationTask, getTasks, getTask, updateTask, completeTask, verifyTask,
    uploadEvidence, getEvidence, deleteEvidence,
    createReport, getReports, getReport, updateReport, deleteReport,
    addReportFindings, generateReport, downloadReport,
    createControl, getControls, getControl, updateControl, linkControlFinding, getComplianceStatus,
    createRetest, getRetests,
    getDashboardOverview, getDashboardRisks, getDashboardCompliance, getDashboardTasks, getRiskHeatmap,
    getAuditLogs, getEntityAuditLogs,
    getNotifications, markNotificationRead,
    ingestNetworkFinding, ingestUctcFinding, ingestSoarIncident, updateSoarTask,
    ingestPhishingRisk, ingestSiemAlert, ingestOpenCtiIoc
} from "./grc.controller.js";

const grcRouter = Router();

// ─── Findings ────────────────────────────────────────────────────────────────
grcRouter.post("/findings",
    isAuthenticated(), isAuthorized(p.findings.create), isValid(createFindingValidation),
    asyncHandler(createFinding)
);
grcRouter.get("/findings",
    isAuthenticated(), isAuthorized(p.findings.read), isValid(listFindingsValidation),
    asyncHandler(getFindings)
);
grcRouter.get("/findings/:id",
    isAuthenticated(), isAuthorized(p.findings.read), isValid(findingIdValidation),
    asyncHandler(getFinding)
);
grcRouter.patch("/findings/:id",
    isAuthenticated(), isAuthorized(p.findings.update), isValid(updateFindingValidation),
    asyncHandler(updateFinding)
);
grcRouter.patch("/findings/:id/assign",
    isAuthenticated(), isAuthorized(p.findings.assign), isValid(assignFindingValidation),
    asyncHandler(assignFinding)
);
grcRouter.patch("/findings/:id/close",
    isAuthenticated(), isAuthorized(p.findings.close), isValid(findingIdValidation),
    asyncHandler(closeFinding)
);
grcRouter.patch("/findings/:id/reopen",
    isAuthenticated(), isAuthorized(p.findings.reopen), isValid(findingIdValidation),
    asyncHandler(reopenFinding)
);
grcRouter.delete("/findings/:id",
    isAuthenticated(), isAuthorized(p.findings.delete), isValid(findingIdValidation),
    asyncHandler(deleteFinding)
);
grcRouter.get("/findings/:id/history",
    isAuthenticated(), isAuthorized(p.findings.read), isValid(findingIdValidation),
    asyncHandler(getFindingHistory)
);
grcRouter.post("/findings/:id/retest",
    isAuthenticated(), isAuthorized(p.findings.retest), isValid(createRetestValidation),
    asyncHandler(createRetest)
);
grcRouter.get("/findings/:id/retests",
    isAuthenticated(), isAuthorized(p.findings.read), isValid(findingIdValidation),
    asyncHandler(getRetests)
);

// ─── Risks ───────────────────────────────────────────────────────────────────
grcRouter.post("/risks",
    isAuthenticated(), isAuthorized(p.risks.create), isValid(createRiskValidation),
    asyncHandler(createRisk)
);
grcRouter.get("/risks",
    isAuthenticated(), isAuthorized(p.risks.read), isValid(listRisksValidation),
    asyncHandler(getRisks)
);
grcRouter.get("/risks/:id",
    isAuthenticated(), isAuthorized(p.risks.read), isValid(riskIdValidation),
    asyncHandler(getRisk)
);
grcRouter.patch("/risks/:id",
    isAuthenticated(), isAuthorized(p.risks.update), isValid(updateRiskValidation),
    asyncHandler(updateRisk)
);
grcRouter.patch("/risks/:id/accept",
    isAuthenticated(), isAuthorized(p.risks.accept), isValid(riskIdValidation),
    asyncHandler(acceptRisk)
);
grcRouter.patch("/risks/:id/mitigate",
    isAuthenticated(), isAuthorized(p.risks.mitigate), isValid(riskIdValidation),
    asyncHandler(mitigateRisk)
);
grcRouter.patch("/risks/:id/close",
    isAuthenticated(), isAuthorized(p.risks.close), isValid(riskIdValidation),
    asyncHandler(closeRisk)
);

// ─── Remediation Tasks ───────────────────────────────────────────────────────
grcRouter.post("/tasks",
    isAuthenticated(), isAuthorized(p.tasks.create), isValid(createTaskValidation),
    asyncHandler(createRemediationTask)
);
grcRouter.get("/tasks",
    isAuthenticated(), isAuthorized(p.tasks.read), isValid(listTasksValidation),
    asyncHandler(getTasks)
);
grcRouter.get("/tasks/:id",
    isAuthenticated(), isAuthorized(p.tasks.read), isValid(taskIdValidation),
    asyncHandler(getTask)
);
grcRouter.patch("/tasks/:id",
    isAuthenticated(), isAuthorized(p.tasks.update), isValid(updateTaskValidation),
    asyncHandler(updateTask)
);
grcRouter.patch("/tasks/:id/complete",
    isAuthenticated(), isAuthorized(p.tasks.complete), isValid(taskIdValidation),
    asyncHandler(completeTask)
);
grcRouter.patch("/tasks/:id/verify",
    isAuthenticated(), isAuthorized(p.tasks.verify), isValid(taskIdValidation),
    asyncHandler(verifyTask)
);

// ─── Evidence ──────────────────────────────────────────────────────────────────
grcRouter.post("/evidence",
    isAuthenticated(), isAuthorized(p.evidence.create),
    evidenceUpload.single("file"),
    isValid(createEvidenceValidation),
    asyncHandler(uploadEvidence)
);
grcRouter.get("/evidence/:id",
    isAuthenticated(), isAuthorized(p.evidence.read), isValid(evidenceIdValidation),
    asyncHandler(getEvidence)
);
grcRouter.delete("/evidence/:id",
    isAuthenticated(), isAuthorized(p.evidence.delete), isValid(evidenceIdValidation),
    asyncHandler(deleteEvidence)
);

// ─── Audit Reports ───────────────────────────────────────────────────────────
grcRouter.post("/reports",
    isAuthenticated(), isAuthorized(p.reports.create), isValid(createReportValidation),
    asyncHandler(createReport)
);
grcRouter.get("/reports",
    isAuthenticated(), isAuthorized(p.reports.read),
    asyncHandler(getReports)
);
grcRouter.get("/reports/:id",
    isAuthenticated(), isAuthorized(p.reports.read), isValid(reportIdValidation),
    asyncHandler(getReport)
);
grcRouter.patch("/reports/:id",
    isAuthenticated(), isAuthorized(p.reports.update), isValid(updateReportValidation),
    asyncHandler(updateReport)
);
grcRouter.delete("/reports/:id",
    isAuthenticated(), isAuthorized(p.reports.delete), isValid(reportIdValidation),
    asyncHandler(deleteReport)
);
grcRouter.post("/reports/:id/findings",
    isAuthenticated(), isAuthorized(p.reports.update), isValid(addReportFindingsValidation),
    asyncHandler(addReportFindings)
);
grcRouter.post("/reports/:id/generate",
    isAuthenticated(), isAuthorized(p.reports.generate), isValid(reportIdValidation),
    asyncHandler(generateReport)
);
grcRouter.get("/reports/:id/download",
    isAuthenticated(), isAuthorized(p.reports.read), isValid(reportIdValidation),
    asyncHandler(downloadReport)
);

// ─── Compliance ──────────────────────────────────────────────────────────────
grcRouter.post("/compliance/controls",
    isAuthenticated(), isAuthorized(p.compliance.create), isValid(createControlValidation),
    asyncHandler(createControl)
);
grcRouter.get("/compliance/controls",
    isAuthenticated(), isAuthorized(p.compliance.read), isValid(listControlsValidation),
    asyncHandler(getControls)
);
grcRouter.get("/compliance/controls/:id",
    isAuthenticated(), isAuthorized(p.compliance.read), isValid(controlIdValidation),
    asyncHandler(getControl)
);
grcRouter.patch("/compliance/controls/:id",
    isAuthenticated(), isAuthorized(p.compliance.update), isValid(updateControlValidation),
    asyncHandler(updateControl)
);
grcRouter.post("/compliance/controls/:id/link-finding",
    isAuthenticated(), isAuthorized(p.compliance.link), isValid(linkControlFindingValidation),
    asyncHandler(linkControlFinding)
);
grcRouter.get("/compliance/status",
    isAuthenticated(), isAuthorized(p.compliance.read),
    asyncHandler(getComplianceStatus)
);

// ─── Dashboard ───────────────────────────────────────────────────────────────
grcRouter.get("/dashboard/overview",
    isAuthenticated(), isAuthorized(p.dashboard.read),
    asyncHandler(getDashboardOverview)
);
grcRouter.get("/dashboard/risks",
    isAuthenticated(), isAuthorized(p.dashboard.read),
    asyncHandler(getDashboardRisks)
);
grcRouter.get("/dashboard/compliance",
    isAuthenticated(), isAuthorized(p.dashboard.read),
    asyncHandler(getDashboardCompliance)
);
grcRouter.get("/dashboard/tasks",
    isAuthenticated(), isAuthorized(p.dashboard.read),
    asyncHandler(getDashboardTasks)
);
grcRouter.get("/dashboard/risk-heatmap",
    isAuthenticated(), isAuthorized(p.dashboard.read),
    asyncHandler(getRiskHeatmap)
);

// ─── Audit Logs ──────────────────────────────────────────────────────────────
grcRouter.get("/audit-logs",
    isAuthenticated(), isAuthorized(p.auditLogs.read), isValid(listAuditLogsValidation),
    asyncHandler(getAuditLogs)
);
grcRouter.get("/audit-logs/:entityType/:entityId",
    isAuthenticated(), isAuthorized(p.auditLogs.read), isValid(entityAuditValidation),
    asyncHandler(getEntityAuditLogs)
);

// ─── Notifications ───────────────────────────────────────────────────────────
grcRouter.get("/notifications",
    isAuthenticated(), isAuthorized(p.notifications.read), isValid(listNotificationsValidation),
    asyncHandler(getNotifications)
);
grcRouter.patch("/notifications/:id/read",
    isAuthenticated(), isAuthorized(p.notifications.read), isValid(notificationIdValidation),
    asyncHandler(markNotificationRead)
);

// ─── Integrations ────────────────────────────────────────────────────────────
grcRouter.post("/integrations/network/findings",
    isServiceOrUserAuthenticated(), isAuthorized(p.integrations.network), isValid(networkFindingValidation),
    asyncHandler(ingestNetworkFinding)
);
grcRouter.post("/integrations/uctc/findings",
    isServiceOrUserAuthenticated(), isAuthorized(p.integrations.uctc), isValid(uctcFindingValidation),
    asyncHandler(ingestUctcFinding)
);
grcRouter.post("/integrations/soar/incidents",
    isServiceOrUserAuthenticated(), isAuthorized(p.integrations.soar), isValid(soarIncidentValidation),
    asyncHandler(ingestSoarIncident)
);
grcRouter.patch("/integrations/soar/tasks/:id",
    isServiceOrUserAuthenticated(), isAuthorized(p.integrations.soar), isValid(soarTaskUpdateValidation),
    asyncHandler(updateSoarTask)
);
grcRouter.post("/integrations/phishing/risk",
    isServiceOrUserAuthenticated(), isAuthorized(p.integrations.phishing), isValid(phishingRiskValidation),
    asyncHandler(ingestPhishingRisk)
);
grcRouter.post("/integrations/siem/alerts",
    isServiceOrUserAuthenticated(), isAuthorized(p.integrations.siem), isValid(siemAlertValidation),
    asyncHandler(ingestSiemAlert)
);
grcRouter.post("/integrations/opencti/ioc",
    isServiceOrUserAuthenticated(), isAuthorized(p.integrations.opencti), isValid(openctiIocValidation),
    asyncHandler(ingestOpenCtiIoc)
);

export default grcRouter;
