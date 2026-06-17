import { Router } from "express";
import { isValid } from "../../middleware/validation.js";
import { asyncHandler } from "../../middleware/asyncHandler.js";
import { isAuthenticated } from "../../middleware/authentication.js";
import { isServiceOrUserAuthenticated } from "../../middleware/serviceAuth.js";
import { isAuthorized } from "../../middleware/authorization.js";
import { soarPermissions as p } from "./permissions.js";
import {
  createIncidentValidation,
  updateIncidentValidation,
  incidentIdValidation,
  listIncidentsValidation,
  createIncidentNoteValidation,
  runIncidentPlaybookValidation,
  closeIncidentValidation,
  createPlaybookValidation,
  updatePlaybookValidation,
  playbookIdValidation,
  playbookRunIdValidation,
  listPlaybookRunsValidation,
  createArtifactValidation,
  artifactIdValidation,
  enrichArtifactValidation,
  bulkEnrichArtifactsValidation,
  webhookPayloadValidation,
  webhookQueryValidation,
  createConnectorValidation,
  updateConnectorValidation,
  connectorIdValidation,
  listConnectorActionsValidation,
  createVaultValidation,
  updateVaultValidation,
  vaultIdValidation,
  analyticsPeriodValidation,
  exportAnalyticsValidation,
  listNotificationsValidation,
  notificationIdValidation,
  grcFindingIntegrationValidation,
  grcRiskIntegrationValidation,
  uctcRuleIntegrationValidation,
  phishingCampaignIntegrationValidation,
  blockIpIntegrationValidation,
  isolateHostIntegrationValidation,
  siemEventIntegrationValidation,
  listQueryValidation,
} from "./soar.validation.js";
import {
  createIncident,
  getIncidents,
  getIncident,
  updateIncident,
  deleteIncident,
  closeIncident,
  getIncidentTimeline,
  getIncidentArtifacts,
  createIncidentArtifact,
  getIncidentNotes,
  createIncidentNote,
  getRelatedIncidents,
  linkRelatedIncident,
  runIncidentPlaybook,
  executePlaybook,
  createPlaybook,
  getPlaybooks,
  getPlaybook,
  updatePlaybook,
  deletePlaybook,
  getPlaybookRuns,
  getPlaybookRun,
  pausePlaybookRun,
  resumePlaybookRun,
  cancelPlaybookRun,
  getArtifacts,
  getArtifact,
  updateArtifact,
  deleteArtifact,
  enrichArtifact,
  enrichArtifactsBulk,
  ingestCrowdStrikeWebhook,
  ingestFortigateWebhook,
  ingestWazuhWebhook,
  ingestDefenderWebhook,
  ingestSplunkWebhook,
  ingestCustomWebhook,
  getAlerts,
  getAlert,
  getWebhookSources,
  createWebhookSource,
  createConnector,
  getConnectors,
  getConnector,
  updateConnector,
  deleteConnector,
  testConnector,
  getConnectorActions,
  createVaultEntry,
  getVaultEntries,
  getVaultEntry,
  updateVaultEntry,
  deleteVaultEntry,
  getDashboardOverview,
  getDashboardIncidents,
  getDashboardPlaybooks,
  getDashboardAutomation,
  getDashboardConnectors,
  getDashboardAnalysts,
  getAnalyticsKpis,
  getAnalyticsReport,
  exportAnalytics,
  getAnalyticsSnapshots,
  getSoarNotifications,
  markSoarNotificationRead,
  markAllSoarNotificationsRead,
  getSoarUnreadCount,
  integrateGrcFinding,
  integrateGrcRisk,
  integrateUctcRule,
  integratePhishingCampaign,
  integrateBlockIp,
  integrateIsolateHost,
  integrateSiemEvent,
} from "./soar.controller.js";

const soarRouter = Router();

// ─── Incidents ───────────────────────────────────────────────────────────────
soarRouter.post(
  "/incidents",
  isAuthenticated(),
  isAuthorized(p.incidents.create),
  isValid(createIncidentValidation),
  asyncHandler(createIncident),
);
soarRouter.get(
  "/incidents",
  isAuthenticated(),
  isAuthorized(p.incidents.read),
  isValid(listIncidentsValidation, "query"),
  asyncHandler(getIncidents),
);
soarRouter.get(
  "/incidents/:id",
  isAuthenticated(),
  isAuthorized(p.incidents.read),
  isValid(incidentIdValidation, "params"),
  asyncHandler(getIncident),
);
soarRouter.patch(
  "/incidents/:id",
  isAuthenticated(),
  isAuthorized(p.incidents.update),
  isValid(incidentIdValidation, "params"),
  isValid(updateIncidentValidation, "body"),
  asyncHandler(updateIncident),
);
soarRouter.delete(
  "/incidents/:id",
  isAuthenticated(),
  isAuthorized(p.incidents.delete),
  isValid(incidentIdValidation, "params"),
  asyncHandler(deleteIncident),
);
soarRouter.patch(
  "/incidents/:id/close",
  isAuthenticated(),
  isAuthorized(p.incidents.update),
  isValid(incidentIdValidation, "params"),
  isValid(closeIncidentValidation, "body"),
  asyncHandler(closeIncident),
);
soarRouter.get(
  "/incidents/:id/timeline",
  isAuthenticated(),
  isAuthorized(p.incidents.read),
  isValid(incidentIdValidation, "params"),
  asyncHandler(getIncidentTimeline),
);
soarRouter.get(
  "/incidents/:id/artifacts",
  isAuthenticated(),
  isAuthorized(p.artifacts.read),
  isValid(incidentIdValidation, "params"),
  asyncHandler(getIncidentArtifacts),
);
soarRouter.post(
  "/incidents/:id/artifacts",
  isAuthenticated(),
  isAuthorized(p.artifacts.create),
  isValid(incidentIdValidation, "params"),
  isValid(createArtifactValidation, "body"),
  asyncHandler(createIncidentArtifact),
);
soarRouter.get(
  "/incidents/:id/notes",
  isAuthenticated(),
  isAuthorized(p.notes.read),
  isValid(incidentIdValidation, "params"),
  asyncHandler(getIncidentNotes),
);
soarRouter.post(
  "/incidents/:id/notes",
  isAuthenticated(),
  isAuthorized(p.notes.create),
  isValid(incidentIdValidation, "params"),
  isValid(createIncidentNoteValidation),
  asyncHandler(createIncidentNote),
);
soarRouter.get(
  "/incidents/:id/related",
  isAuthenticated(),
  isAuthorized(p.incidents.read),
  isValid(incidentIdValidation, "params"),
  asyncHandler(getRelatedIncidents),
);
soarRouter.post(
  "/incidents/:id/related",
  isAuthenticated(),
  isAuthorized(p.incidents.update),
  isValid(incidentIdValidation, "params"),
  asyncHandler(linkRelatedIncident),
);
soarRouter.post(
  "/incidents/:id/playbooks/run",
  isAuthenticated(),
  isAuthorized(p.playbooks.execute),
  isValid(incidentIdValidation, "params"),
  isValid(runIncidentPlaybookValidation, "body"),
  asyncHandler(runIncidentPlaybook),
);
soarRouter.post(
  "/incidents/:incidentId/playbook/:playbookId",
  isAuthenticated(),
  isAuthorized(p.playbooks.execute),
  asyncHandler(executePlaybook),
);
soarRouter.patch(
  "/incidents/:incidentId/close",
  isAuthenticated(),
  isAuthorized(p.incidents.update),
  isValid(closeIncidentValidation, "body"),
  asyncHandler(closeIncident),
);

// ─── Playbooks ───────────────────────────────────────────────────────────────
soarRouter.post(
  "/playbooks",
  isAuthenticated(),
  isAuthorized(p.playbooks.create),
  isValid(createPlaybookValidation),
  asyncHandler(createPlaybook),
);
soarRouter.get(
  "/playbooks",
  isAuthenticated(),
  isAuthorized(p.playbooks.read),
  isValid(listQueryValidation, "query"),
  asyncHandler(getPlaybooks),
);
soarRouter.get(
  "/playbooks/:id",
  isAuthenticated(),
  isAuthorized(p.playbooks.read),
  isValid(playbookIdValidation, "params"),
  asyncHandler(getPlaybook),
);
soarRouter.patch(
  "/playbooks/:id",
  isAuthenticated(),
  isAuthorized(p.playbooks.update),
  isValid(playbookIdValidation, "params"),
  isValid(updatePlaybookValidation),
  asyncHandler(updatePlaybook),
);
soarRouter.delete(
  "/playbooks/:id",
  isAuthenticated(),
  isAuthorized(p.playbooks.delete),
  isValid(playbookIdValidation, "params"),
  asyncHandler(deletePlaybook),
);
soarRouter.get(
  "/playbook-runs",
  isAuthenticated(),
  isAuthorized(p.playbookRuns.read),
  isValid(listPlaybookRunsValidation, "query"),
  asyncHandler(getPlaybookRuns),
);
soarRouter.get(
  "/playbook-runs/:runId",
  isAuthenticated(),
  isAuthorized(p.playbookRuns.read),
  isValid(playbookRunIdValidation, "params"),
  asyncHandler(getPlaybookRun),
);
soarRouter.post(
  "/playbook-runs/:runId/pause",
  isAuthenticated(),
  isAuthorized(p.playbookRuns.control),
  isValid(playbookRunIdValidation, "params"),
  asyncHandler(pausePlaybookRun),
);
soarRouter.post(
  "/playbook-runs/:runId/resume",
  isAuthenticated(),
  isAuthorized(p.playbookRuns.control),
  isValid(playbookRunIdValidation, "params"),
  asyncHandler(resumePlaybookRun),
);
soarRouter.post(
  "/playbook-runs/:runId/cancel",
  isAuthenticated(),
  isAuthorized(p.playbookRuns.control),
  isValid(playbookRunIdValidation, "params"),
  asyncHandler(cancelPlaybookRun),
);

// ─── Artifacts ───────────────────────────────────────────────────────────────
soarRouter.get(
  "/artifacts",
  isAuthenticated(),
  isAuthorized(p.artifacts.read),
  isValid(listQueryValidation, "query"),
  asyncHandler(getArtifacts),
);
soarRouter.get(
  "/artifacts/:id",
  isAuthenticated(),
  isAuthorized(p.artifacts.read),
  isValid(artifactIdValidation, "params"),
  asyncHandler(getArtifact),
);
soarRouter.patch(
  "/artifacts/:id",
  isAuthenticated(),
  isAuthorized(p.artifacts.create),
  isValid(artifactIdValidation, "params"),
  asyncHandler(updateArtifact),
);
soarRouter.delete(
  "/artifacts/:id",
  isAuthenticated(),
  isAuthorized(p.artifacts.create),
  isValid(artifactIdValidation, "params"),
  asyncHandler(deleteArtifact),
);
soarRouter.post(
  "/artifacts/:id/enrich",
  isAuthenticated(),
  isAuthorized(p.artifacts.enrich),
  isValid(artifactIdValidation, "params"),
  isValid(enrichArtifactValidation),
  asyncHandler(enrichArtifact),
);
soarRouter.post(
  "/artifacts/enrich/bulk",
  isAuthenticated(),
  isAuthorized(p.artifacts.enrich),
  isValid(bulkEnrichArtifactsValidation),
  asyncHandler(enrichArtifactsBulk),
);

// ─── Webhooks ────────────────────────────────────────────────────────────────
soarRouter.post(
  "/webhooks/crowdstrike",
  isAuthenticated(),
  isAuthorized(p.webhooks.ingest),
  isValid(webhookPayloadValidation),
  isValid(webhookQueryValidation, "query"),
  asyncHandler(ingestCrowdStrikeWebhook),
);
soarRouter.post(
  "/webhooks/fortigate",
  isAuthenticated(),
  isAuthorized(p.webhooks.ingest),
  isValid(webhookPayloadValidation),
  isValid(webhookQueryValidation, "query"),
  asyncHandler(ingestFortigateWebhook),
);
soarRouter.post(
  "/webhooks/wazuh",
  isAuthenticated(),
  isAuthorized(p.webhooks.ingest),
  isValid(webhookPayloadValidation),
  isValid(webhookQueryValidation, "query"),
  asyncHandler(ingestWazuhWebhook),
);
soarRouter.post(
  "/webhooks/defender",
  isAuthenticated(),
  isAuthorized(p.webhooks.ingest),
  isValid(webhookPayloadValidation),
  isValid(webhookQueryValidation, "query"),
  asyncHandler(ingestDefenderWebhook),
);
soarRouter.post(
  "/webhooks/splunk",
  isAuthenticated(),
  isAuthorized(p.webhooks.ingest),
  isValid(webhookPayloadValidation),
  isValid(webhookQueryValidation, "query"),
  asyncHandler(ingestSplunkWebhook),
);
soarRouter.post(
  "/webhooks/custom",
  isAuthenticated(),
  isAuthorized(p.webhooks.ingest),
  isValid(webhookPayloadValidation, "body"),
  isValid(webhookQueryValidation, "query"),
  asyncHandler(ingestCustomWebhook),
);
soarRouter.get(
  "/alerts",
  isAuthenticated(),
  isAuthorized(p.incidents.read),
  isValid(listQueryValidation, "query"),
  asyncHandler(getAlerts),
);
soarRouter.get(
  "/alerts/:id",
  isAuthenticated(),
  isAuthorized(p.incidents.read),
  isValid(artifactIdValidation, "params"),
  asyncHandler(getAlert),
);
soarRouter.get(
  "/webhook-sources",
  isAuthenticated(),
  isAuthorized(p.webhooks.ingest),
  asyncHandler(getWebhookSources),
);
soarRouter.post(
  "/webhook-sources",
  isAuthenticated(),
  isAuthorized(p.webhooks.ingest),
  asyncHandler(createWebhookSource),
);

// ─── Connectors ──────────────────────────────────────────────────────────────
soarRouter.post(
  "/connectors",
  isAuthenticated(),
  isAuthorized(p.connectors.create),
  isValid(createConnectorValidation),
  asyncHandler(createConnector),
);
soarRouter.get(
  "/connectors",
  isAuthenticated(),
  isAuthorized(p.connectors.read),
  isValid(listQueryValidation, "query"),
  asyncHandler(getConnectors),
);
soarRouter.get(
  "/connectors/:id",
  isAuthenticated(),
  isAuthorized(p.connectors.read),
  isValid(connectorIdValidation, "params"),
  asyncHandler(getConnector),
);
soarRouter.patch(
  "/connectors/:id",
  isAuthenticated(),
  isAuthorized(p.connectors.update),
  isValid(connectorIdValidation, "params"),
  isValid(updateConnectorValidation),
  asyncHandler(updateConnector),
);
soarRouter.delete(
  "/connectors/:id",
  isAuthenticated(),
  isAuthorized(p.connectors.delete),
  isValid(connectorIdValidation, "params"),
  asyncHandler(deleteConnector),
);
soarRouter.post(
  "/connectors/:id/test",
  isAuthenticated(),
  isAuthorized(p.connectors.test),
  isValid(connectorIdValidation, "params"),
  asyncHandler(testConnector),
);
soarRouter.get(
  "/connectors/:id/actions",
  isAuthenticated(),
  isAuthorized(p.connectors.read),
  isValid(connectorIdValidation, "params"),
  isValid(listConnectorActionsValidation, "query"),
  asyncHandler(getConnectorActions),
);

// ─── Vault ───────────────────────────────────────────────────────────────────
soarRouter.post(
  "/vault",
  isAuthenticated(),
  isAuthorized(p.vault.create),
  isValid(createVaultValidation),
  asyncHandler(createVaultEntry),
);
soarRouter.get(
  "/vault",
  isAuthenticated(),
  isAuthorized(p.vault.read),
  isValid(listQueryValidation, "query"),
  asyncHandler(getVaultEntries),
);
soarRouter.get(
  "/vault/:id",
  isAuthenticated(),
  isAuthorized(p.vault.read),
  isValid(vaultIdValidation, "params"),
  asyncHandler(getVaultEntry),
);
soarRouter.patch(
  "/vault/:id",
  isAuthenticated(),
  isAuthorized(p.vault.update),
  isValid(vaultIdValidation, "params"),
  isValid(updateVaultValidation),
  asyncHandler(updateVaultEntry),
);
soarRouter.delete(
  "/vault/:id",
  isAuthenticated(),
  isAuthorized(p.vault.delete),
  isValid(vaultIdValidation, "params"),
  asyncHandler(deleteVaultEntry),
);

// ─── Dashboard ───────────────────────────────────────────────────────────────
soarRouter.get(
  "/dashboard/overview",
  isAuthenticated(),
  isAuthorized(p.dashboard.read),
  asyncHandler(getDashboardOverview),
);
soarRouter.get(
  "/dashboard/incidents",
  isAuthenticated(),
  isAuthorized(p.dashboard.read),
  asyncHandler(getDashboardIncidents),
);
soarRouter.get(
  "/dashboard/playbooks",
  isAuthenticated(),
  isAuthorized(p.dashboard.read),
  asyncHandler(getDashboardPlaybooks),
);
soarRouter.get(
  "/dashboard/automation",
  isAuthenticated(),
  isAuthorized(p.dashboard.read),
  asyncHandler(getDashboardAutomation),
);
soarRouter.get(
  "/dashboard/connectors",
  isAuthenticated(),
  isAuthorized(p.dashboard.read),
  asyncHandler(getDashboardConnectors),
);
soarRouter.get(
  "/dashboard/analysts",
  isAuthenticated(),
  isAuthorized(p.dashboard.read),
  asyncHandler(getDashboardAnalysts),
);

// ─── Analytics ───────────────────────────────────────────────────────────────
soarRouter.get(
  "/analytics/kpis",
  isAuthenticated(),
  isAuthorized(p.analytics.read),
  isValid(analyticsPeriodValidation, "query"),
  asyncHandler(getAnalyticsKpis),
);
soarRouter.get(
  "/analytics/report",
  isAuthenticated(),
  isAuthorized(p.analytics.read),
  isValid(analyticsPeriodValidation, "query"),
  asyncHandler(getAnalyticsReport),
);
soarRouter.post(
  "/analytics/export",
  isAuthenticated(),
  isAuthorized(p.analytics.export),
  isValid(exportAnalyticsValidation),
  asyncHandler(exportAnalytics),
);
soarRouter.get(
  "/analytics/snapshots",
  isAuthenticated(),
  isAuthorized(p.analytics.read),
  isValid(listQueryValidation, "query"),
  asyncHandler(getAnalyticsSnapshots),
);

// ─── Notifications ───────────────────────────────────────────────────────────
soarRouter.get(
  "/notifications",
  isAuthenticated(),
  isAuthorized(p.notifications.read),
  isValid(listNotificationsValidation, "query"),
  asyncHandler(getSoarNotifications),
);
soarRouter.patch(
  "/notifications/:id/read",
  isAuthenticated(),
  isAuthorized(p.notifications.update),
  isValid(notificationIdValidation, "params"),
  asyncHandler(markSoarNotificationRead),
);
soarRouter.patch(
  "/notifications/read-all",
  isAuthenticated(),
  isAuthorized(p.notifications.update),
  asyncHandler(markAllSoarNotificationsRead),
);
soarRouter.get(
  "/notifications/unread-count",
  isAuthenticated(),
  isAuthorized(p.notifications.read),
  asyncHandler(getSoarUnreadCount),
);

// ─── Integrations ────────────────────────────────────────────────────────────
soarRouter.post(
  "/integrations/grc/finding",
  isServiceOrUserAuthenticated(),
  isAuthorized(p.integrations.execute),
  isValid(grcFindingIntegrationValidation),
  asyncHandler(integrateGrcFinding),
);
soarRouter.post(
  "/integrations/grc/risk",
  isServiceOrUserAuthenticated(),
  isAuthorized(p.integrations.execute),
  isValid(grcRiskIntegrationValidation),
  asyncHandler(integrateGrcRisk),
);
soarRouter.post(
  "/integrations/uctc/rule",
  isServiceOrUserAuthenticated(),
  isAuthorized(p.integrations.execute),
  isValid(uctcRuleIntegrationValidation),
  asyncHandler(integrateUctcRule),
);
soarRouter.post(
  "/integrations/uctc/rule-trigger",
  isServiceOrUserAuthenticated(),
  isAuthorized(p.integrations.execute),
  isValid(uctcRuleIntegrationValidation),
  asyncHandler(integrateUctcRule),
);
soarRouter.post(
  "/integrations/phishing/campaign",
  isServiceOrUserAuthenticated(),
  isAuthorized(p.integrations.execute),
  isValid(phishingCampaignIntegrationValidation),
  asyncHandler(integratePhishingCampaign),
);
soarRouter.post(
  "/integrations/firewall/block-ip",
  isServiceOrUserAuthenticated(),
  isAuthorized(p.integrations.execute),
  isValid(blockIpIntegrationValidation),
  asyncHandler(integrateBlockIp),
);
soarRouter.post(
  "/integrations/network/block-ip",
  isServiceOrUserAuthenticated(),
  isAuthorized(p.integrations.execute),
  isValid(blockIpIntegrationValidation),
  asyncHandler(integrateBlockIp),
);
soarRouter.post(
  "/integrations/edr/isolate-host",
  isServiceOrUserAuthenticated(),
  isAuthorized(p.integrations.execute),
  isValid(isolateHostIntegrationValidation),
  asyncHandler(integrateIsolateHost),
);
soarRouter.post(
  "/integrations/network/isolate-host",
  isServiceOrUserAuthenticated(),
  isAuthorized(p.integrations.execute),
  isValid(isolateHostIntegrationValidation),
  asyncHandler(integrateIsolateHost),
);
soarRouter.post(
  "/integrations/siem/event",
  isServiceOrUserAuthenticated(),
  isAuthorized(p.integrations.execute),
  isValid(siemEventIntegrationValidation),
  asyncHandler(integrateSiemEvent),
);

export default soarRouter;
