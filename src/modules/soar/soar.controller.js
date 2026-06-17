import { successResponse, paginatedResponse } from "../../utils/apiResponse.js";
import { messages } from "../../utils/constant/messages.js";
import * as incidentService from "./services/incident.service.js";
import * as playbookService from "./services/playbook.service.js";
import * as artifactService from "./services/artifact.service.js";
import * as webhookService from "./services/webhook.service.js";
import * as connectorService from "./services/connector.service.js";
import * as dashboardService from "./services/dashboard.service.js";
import * as analyticsService from "./services/analytics.service.js";
import * as notificationService from "./services/notification.service.js";
import * as integrationService from "./services/integration.service.js";
import * as vaultService from "./services/vault.service.js";

// ─── Incidents ───────────────────────────────────────────────────────────────

export const createIncident = async (req, res) => {
  const incident = await incidentService.createIncident(req.body, req.authUser);
  return successResponse(res, {
    message: messages.incident.createdSuccessfully,
    data: incident,
    statusCode: 201,
  });
};

export const getIncidents = async (req, res) => {
  const result = await incidentService.listIncidents(req.query);
  return paginatedResponse(res, {
    message: "Incidents fetched",
    data: result.data,
    page: result.page,
    limit: result.limit,
    total: result.total,
  });
};

export const getIncident = async (req, res) => {
  const incident = await incidentService.getIncidentById(req.params.id);
  return successResponse(res, { message: "Incident fetched", data: incident });
};

export const updateIncident = async (req, res) => {
  const incident = await incidentService.updateIncident(
    req.params.id,
    req.body,
    req.authUser,
  );
  return successResponse(res, {
    message: messages.incident.updatedSuccessfully,
    data: incident,
  });
};

export const deleteIncident = async (req, res) => {
  const incident = await incidentService.softDeleteIncident(
    req.params.id,
    req.authUser,
  );
  return successResponse(res, {
    message: "Incident deleted successfully",
    data: incident,
  });
};

export const closeIncident = async (req, res) => {
  const id = req.params.id || req.params.incidentId;
  const incident = await incidentService.closeIncident(
    id,
    req.body,
    req.authUser,
  );
  return successResponse(res, {
    message: messages.incident.closedSuccessfully,
    data: incident,
  });
};

export const getIncidentTimeline = async (req, res) => {
  const timeline = await incidentService.getIncidentTimeline(req.params.id);
  return successResponse(res, {
    message: "Incident timeline fetched",
    data: timeline,
  });
};

export const getIncidentArtifacts = async (req, res) => {
  const artifacts = await artifactService.listArtifactsByIncident(
    req.params.id,
  );
  return successResponse(res, {
    message: "Incident artifacts fetched",
    data: artifacts,
  });
};

export const createIncidentArtifact = async (req, res) => {
  const artifact = await artifactService.createArtifact(
    { ...req.body, incidentId: req.params.id },
    req.authUser,
  );
  return successResponse(res, {
    message: "Artifact created",
    data: artifact,
    statusCode: 201,
  });
};

export const getIncidentNotes = async (req, res) => {
  const notes = await incidentService.listIncidentNotes(req.params.id);
  return successResponse(res, {
    message: "Incident notes fetched",
    data: notes,
  });
};

export const createIncidentNote = async (req, res) => {
  const note = await incidentService.addIncidentNote(
    req.params.id,
    req.body.content,
    req.authUser,
    req.body.isInternal,
  );
  return successResponse(res, {
    message: "Incident note created",
    data: note,
    statusCode: 201,
  });
};

export const getRelatedIncidents = async (req, res) => {
  const related = await incidentService.getRelatedIncidents(req.params.id);
  return successResponse(res, {
    message: "Related incidents fetched",
    data: related,
  });
};

export const linkRelatedIncident = async (req, res) => {
  const incident = await incidentService.linkRelatedIncident(
    req.params.id,
    req.body.relatedIncidentId,
    req.authUser,
  );
  return successResponse(res, { message: "Incident linked", data: incident });
};

export const runIncidentPlaybook = async (req, res) => {
  const result = await playbookService.executePlaybook(
    {
      incidentId: req.params.id,
      playbookId: req.body.playbookId,
      context: req.body.context,
    },
    req.authUser,
  );

  return successResponse(res, {
    message: messages.playbook.executedSuccessfully,
    data: result,
    statusCode: 202,
  });
};

export const executePlaybook = async (req, res) => {
  const result = await playbookService.executePlaybook(
    {
      incidentId: req.params.incidentId,
      playbookId: req.params.playbookId,
      context: req.body,
    },
    req.authUser,
  );

  return successResponse(res, {
    message: messages.playbook.executedSuccessfully,
    data: result,
    statusCode: 202,
  });
};

// ─── Playbooks ───────────────────────────────────────────────────────────────

export const createPlaybook = async (req, res) => {
  const playbook = await playbookService.createPlaybook(req.body, req.authUser);
  return successResponse(res, {
    message: messages.playbook.createdSuccessfully,
    data: playbook,
    statusCode: 201,
  });
};

export const getPlaybooks = async (req, res) => {
  const result = await playbookService.listPlaybooks(req.query);
  return paginatedResponse(res, {
    message: "Playbooks fetched",
    data: result.data,
    page: result.page,
    limit: result.limit,
    total: result.total,
  });
};

export const getPlaybook = async (req, res) => {
  const playbook = await playbookService.getPlaybookById(req.params.id);
  return successResponse(res, { message: "Playbook fetched", data: playbook });
};

export const updatePlaybook = async (req, res) => {
  const playbook = await playbookService.updatePlaybook(
    req.params.id,
    req.body,
    req.authUser,
  );
  return successResponse(res, {
    message: messages.playbook.updatedSuccessfully,
    data: playbook,
  });
};

export const deletePlaybook = async (req, res) => {
  const playbook = await playbookService.softDeletePlaybook(
    req.params.id,
    req.authUser,
  );
  return successResponse(res, {
    message: messages.playbook.deletedSuccessfully,
    data: playbook,
  });
};

export const getPlaybookRuns = async (req, res) => {
  const result = await playbookService.listPlaybookRuns(req.query);
  return paginatedResponse(res, {
    message: "Playbook runs fetched",
    data: result.data,
    page: result.page,
    limit: result.limit,
    total: result.total,
  });
};

export const getPlaybookRun = async (req, res) => {
  const run = await playbookService.getRunStatus(req.params.runId);
  return successResponse(res, { message: "Playbook run fetched", data: run });
};

export const pausePlaybookRun = async (req, res) => {
  const run = await playbookService.pauseRun(req.params.runId, req.authUser);
  return successResponse(res, { message: "Playbook run paused", data: run });
};

export const resumePlaybookRun = async (req, res) => {
  const run = await playbookService.resumeRun(req.params.runId, req.authUser);
  return successResponse(res, { message: "Playbook run resumed", data: run });
};

export const cancelPlaybookRun = async (req, res) => {
  const run = await playbookService.cancelRun(req.params.runId, req.authUser);
  return successResponse(res, { message: "Playbook run cancelled", data: run });
};

// ─── Artifacts ───────────────────────────────────────────────────────────────

export const getArtifacts = async (req, res) => {
  const result = await artifactService.listArtifacts(req.query);
  return paginatedResponse(res, {
    message: "Artifacts fetched",
    data: result.data,
    page: result.page,
    limit: result.limit,
    total: result.total,
  });
};

export const getArtifact = async (req, res) => {
  const artifact = await artifactService.getArtifactById(req.params.id);
  return successResponse(res, { message: "Artifact fetched", data: artifact });
};

export const updateArtifact = async (req, res) => {
  const artifact = await artifactService.updateArtifact(
    req.params.id,
    req.body,
    req.authUser,
  );
  return successResponse(res, { message: "Artifact updated", data: artifact });
};

export const deleteArtifact = async (req, res) => {
  const artifact = await artifactService.softDeleteArtifact(
    req.params.id,
    req.authUser,
  );
  return successResponse(res, { message: "Artifact deleted", data: artifact });
};

export const enrichArtifact = async (req, res) => {
  const result = await artifactService.enrichArtifact(
    req.params.id,
    req.authUser,
    req.body.providers,
  );
  return successResponse(res, {
    message: "Artifact enrichment queued",
    data: result,
    statusCode: 202,
  });
};

export const enrichArtifactsBulk = async (req, res) => {
  const result = await artifactService.enrichArtifactsBulk(
    req.body.artifactIds,
    req.authUser,
    req.body.providers,
  );
  return successResponse(res, {
    message: "Bulk enrichment queued",
    data: result,
    statusCode: 202,
  });
};

// ─── Webhooks ────────────────────────────────────────────────────────────────

const ingestWebhook = (handler) => async (req, res) => {
  const createIncident = req.query.createIncident !== "false";
  const result = await handler(req.body, {
    signature: req.headers["x-webhook-signature"],
    webhookSourceId: req.query.webhookSourceId,
    createIncident,
    user: req.authUser,
  });

  return successResponse(res, {
    message: "Webhook alert ingested",
    data: result,
    statusCode: 202,
  });
};

export const ingestCrowdStrikeWebhook = ingestWebhook(
  webhookService.ingestCrowdStrikeAlert,
);
export const ingestFortigateWebhook = ingestWebhook(
  webhookService.ingestFortigateAlert,
);
export const ingestWazuhWebhook = ingestWebhook(
  webhookService.ingestWazuhAlert,
);
export const ingestDefenderWebhook = ingestWebhook(
  webhookService.ingestDefenderAlert,
);
export const ingestSplunkWebhook = ingestWebhook(
  webhookService.ingestSplunkAlert,
);
export const ingestCustomWebhook = ingestWebhook(
  webhookService.ingestCustomAlert,
);

export const getAlerts = async (req, res) => {
  const result = await webhookService.listAlerts(req.query);
  return paginatedResponse(res, {
    message: "Alerts fetched",
    data: result.data,
    page: result.page,
    limit: result.limit,
    total: result.total,
  });
};

export const getAlert = async (req, res) => {
  const alert = await webhookService.getAlertById(req.params.id);
  return successResponse(res, { message: "Alert fetched", data: alert });
};

export const getWebhookSources = async (req, res) => {
  const sources = await webhookService.listWebhookSources();
  return successResponse(res, {
    message: "Webhook sources fetched",
    data: sources,
  });
};

export const createWebhookSource = async (req, res) => {
  const source = await webhookService.createWebhookSource(
    req.body,
    req.authUser,
  );
  return successResponse(res, {
    message: "Webhook source created",
    data: source,
    statusCode: 201,
  });
};

// ─── Connectors ──────────────────────────────────────────────────────────────

export const createConnector = async (req, res) => {
  const connector = await connectorService.createConnector(
    req.body,
    req.authUser,
  );
  return successResponse(res, {
    message: "Connector created",
    data: connector,
    statusCode: 201,
  });
};

export const getConnectors = async (req, res) => {
  const result = await connectorService.listConnectors(req.query);
  return paginatedResponse(res, {
    message: "Connectors fetched",
    data: result.data,
    page: result.page,
    limit: result.limit,
    total: result.total,
  });
};

export const getConnector = async (req, res) => {
  const connector = await connectorService.getConnectorById(req.params.id);
  return successResponse(res, {
    message: "Connector fetched",
    data: connector,
  });
};

export const updateConnector = async (req, res) => {
  const connector = await connectorService.updateConnector(
    req.params.id,
    req.body,
    req.authUser,
  );
  return successResponse(res, {
    message: "Connector updated",
    data: connector,
  });
};

export const deleteConnector = async (req, res) => {
  const connector = await connectorService.softDeleteConnector(
    req.params.id,
    req.authUser,
  );
  return successResponse(res, {
    message: "Connector deleted",
    data: connector,
  });
};

export const testConnector = async (req, res) => {
  const result = await connectorService.testConnector(
    req.params.id,
    req.authUser,
  );
  return successResponse(res, {
    message: "Connector test succeeded",
    data: result,
  });
};

export const getConnectorActions = async (req, res) => {
  const result = await connectorService.listConnectorActions(
    req.params.id,
    req.query,
  );
  return successResponse(res, {
    message: "Connector actions fetched",
    data: result,
  });
};

// ─── Vault ───────────────────────────────────────────────────────────────────

export const createVaultEntry = async (req, res) => {
  const vault = await vaultService.createVaultEntry(req.body, req.authUser);
  return successResponse(res, {
    message: "Vault entry created",
    data: vault,
    statusCode: 201,
  });
};

export const getVaultEntries = async (req, res) => {
  const result = await vaultService.listVaultEntries(req.query);
  return paginatedResponse(res, {
    message: "Vault entries fetched",
    data: result.data,
    page: result.page,
    limit: result.limit,
    total: result.total,
  });
};

export const getVaultEntry = async (req, res) => {
  const vault = await vaultService.getVaultById(req.params.id);
  return successResponse(res, { message: "Vault entry fetched", data: vault });
};

export const updateVaultEntry = async (req, res) => {
  const vault = await vaultService.updateVaultEntry(
    req.params.id,
    req.body,
    req.authUser,
  );
  return successResponse(res, { message: "Vault entry updated", data: vault });
};

export const deleteVaultEntry = async (req, res) => {
  const vault = await vaultService.softDeleteVaultEntry(
    req.params.id,
    req.authUser,
  );
  return successResponse(res, { message: "Vault entry deleted", data: vault });
};

// ─── Dashboard ───────────────────────────────────────────────────────────────

export const getDashboardOverview = async (req, res) => {
  const overview = await dashboardService.getOverview();
  return successResponse(res, {
    message: "Dashboard overview fetched",
    data: overview,
  });
};

export const getDashboardIncidents = async (req, res) => {
  const data = await dashboardService.getIncidentsDashboard();
  return successResponse(res, { message: "Incidents dashboard fetched", data });
};

export const getDashboardPlaybooks = async (req, res) => {
  const data = await dashboardService.getPlaybooksDashboard();
  return successResponse(res, { message: "Playbooks dashboard fetched", data });
};

export const getDashboardAutomation = async (req, res) => {
  const data = await dashboardService.getAutomationDashboard();
  return successResponse(res, {
    message: "Automation dashboard fetched",
    data,
  });
};

export const getDashboardConnectors = async (req, res) => {
  const data = await dashboardService.getConnectorsDashboard();
  return successResponse(res, {
    message: "Connectors dashboard fetched",
    data,
  });
};

export const getDashboardAnalysts = async (req, res) => {
  const data = await dashboardService.getAnalystsDashboard();
  return successResponse(res, { message: "Analysts dashboard fetched", data });
};

// ─── Analytics ───────────────────────────────────────────────────────────────

export const getAnalyticsKpis = async (req, res) => {
  const data = await analyticsService.getKpis(Number(req.query.days) || 30);
  return successResponse(res, { message: "Analytics KPIs fetched", data });
};

export const getAnalyticsReport = async (req, res) => {
  const data = await analyticsService.getAnalyticsReport(
    Number(req.query.days) || 30,
  );
  return successResponse(res, { message: "Analytics report fetched", data });
};

export const exportAnalytics = async (req, res) => {
  const result = await analyticsService.exportAnalytics(req.authUser, req.body);
  return successResponse(res, {
    message: "Analytics export queued",
    data: result,
    statusCode: 202,
  });
};

export const getAnalyticsSnapshots = async (req, res) => {
  const result = await analyticsService.listAnalyticsSnapshots(req.query);
  return paginatedResponse(res, {
    message: "Analytics snapshots fetched",
    data: result.data,
    page: result.page,
    limit: result.limit,
    total: result.total,
  });
};

// ─── Notifications ───────────────────────────────────────────────────────────

export const getSoarNotifications = async (req, res) => {
  const result = await notificationService.listSoarNotifications(
    req.authUser._id,
    req.query,
  );
  return successResponse(res, {
    message: "Notifications fetched",
    data: result.data,
    pagination: { page: result.page, limit: result.limit, total: result.total },
    meta: { unreadCount: result.unreadCount },
  });
};

export const markSoarNotificationRead = async (req, res) => {
  const notification = await notificationService.markNotificationRead(
    req.params.id,
    req.authUser._id,
  );
  return successResponse(res, {
    message: "Notification marked read",
    data: notification,
  });
};

export const markAllSoarNotificationsRead = async (req, res) => {
  const result = await notificationService.markAllNotificationsRead(
    req.authUser._id,
  );
  return successResponse(res, {
    message: "Notifications marked read",
    data: result,
  });
};

export const getSoarUnreadCount = async (req, res) => {
  const result = await notificationService.getUnreadCount(req.authUser._id);
  return successResponse(res, {
    message: "Unread count fetched",
    data: result,
  });
};

// ─── Integrations ────────────────────────────────────────────────────────────

export const integrateGrcFinding = async (req, res) => {
  const result = await integrationService.pushGrcFinding(
    req.body,
    req.authUser,
  );
  return successResponse(res, {
    message: "GRC finding pushed",
    data: result,
    statusCode: 201,
  });
};

export const integrateGrcRisk = async (req, res) => {
  const result = await integrationService.pushGrcRisk(req.body, req.authUser);
  return successResponse(res, {
    message: "GRC risk pushed",
    data: result,
    statusCode: 201,
  });
};

export const integrateUctcRule = async (req, res) => {
  const result = await integrationService.triggerUctcRule(
    req.body,
    req.authUser,
  );
  return successResponse(res, {
    message: "UCTC rule triggered",
    data: result,
    statusCode: 202,
  });
};

export const integratePhishingCampaign = async (req, res) => {
  const result = await integrationService.pushPhishingCampaign(
    req.body,
    req.authUser,
  );
  return successResponse(res, {
    message: "Phishing campaign linked",
    data: result,
    statusCode: 202,
  });
};

export const integrateBlockIp = async (req, res) => {
  const result = await integrationService.blockIp(req.body, req.authUser);
  return successResponse(res, { message: "IP block executed", data: result });
};

export const integrateIsolateHost = async (req, res) => {
  const result = await integrationService.isolateHostAction(
    req.body,
    req.authUser,
  );
  return successResponse(res, {
    message: "Host isolation executed",
    data: result,
  });
};

export const integrateSiemEvent = async (req, res) => {
  const result = await integrationService.pushSiemEvent(req.body, req.authUser);
  return successResponse(res, {
    message: "SIEM event pushed",
    data: result,
    statusCode: 201,
  });
};
