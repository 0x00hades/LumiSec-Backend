import Joi from "joi";
import {
  incidentSeverity,
  incidentStatus,
  artifactType,
  playbookTrigger,
  connectorType,
  notificationType,
} from "../../utils/constant/enums.js";

const objectId = Joi.string().hex().length(24);

const playbookActionSchema = Joi.object({
  id: Joi.string().optional(),
  type: Joi.string()
    .valid(
      "block_ip",
      "isolate_host",
      "enrich",
      "notify",
      "ssh_command",
      "create_ticket",
      "send_email",
      "custom_action",
    )
    .required(),
  params: Joi.object().optional(),
  order: Joi.number().integer().min(0).required(),
  nextOnSuccess: Joi.string().optional(),
  nextOnFailure: Joi.string().optional(),
  condition: Joi.string().optional(),
});

export const listQueryValidation = Joi.object({
  page: Joi.number().integer().min(1).optional(),
  limit: Joi.number().integer().min(1).max(100).optional(),
  sort: Joi.string().optional(),
  search: Joi.string().optional(),
});

export const analyticsPeriodValidation = Joi.object({
  days: Joi.number().integer().min(1).max(365).default(30),
  limit: Joi.number().integer().min(1).max(50).optional(),
});

// ─── Incidents ───────────────────────────────────────────────────────────────

export const createIncidentValidation = Joi.object({
  title: Joi.string().min(2).max(200).required(),
  description: Joi.string().max(5000).optional(),
  severity: Joi.string()
    .valid(...Object.values(incidentSeverity))
    .required(),
  status: Joi.string()
    .valid(incidentStatus.NEW, incidentStatus.OPEN)
    .optional(),
  incidentType: Joi.string().max(100).optional(),
  sourceIP: Joi.string()
    .ip({ version: ["ipv4", "ipv6"] })
    .optional(),
  affectedHost: Joi.string().max(255).optional(),
  assignedTo: objectId.optional(),
  tags: Joi.array().items(Joi.string().max(50)).optional(),
  playbookId: objectId.optional(),
});

export const updateIncidentValidation = Joi.object({
  title: Joi.string().min(2).max(200).optional(),
  description: Joi.string().max(5000).optional(),
  severity: Joi.string()
    .valid(...Object.values(incidentSeverity))
    .optional(),
  status: Joi.string()
    .valid(...Object.values(incidentStatus))
    .optional(),
  incidentType: Joi.string().max(100).optional(),
  sourceIP: Joi.string()
    .ip({ version: ["ipv4", "ipv6"] })
    .allow(null, "")
    .optional(),
  affectedHost: Joi.string().max(255).allow(null, "").optional(),
  assignedTo: objectId.allow(null).optional(),
  tags: Joi.array().items(Joi.string().max(50)).optional(),
  relatedIncidents: Joi.array().items(objectId).optional(),
  notes: Joi.string().max(5000).optional(),
  isFalsePositive: Joi.boolean().optional(),
  resolution: Joi.string().max(2000).optional(),
});

export const incidentIdValidation = Joi.object({
  id: objectId.required(),
});

export const listIncidentsValidation = listQueryValidation.keys({
  severity: Joi.string()
    .valid(...Object.values(incidentSeverity))
    .optional(),
  status: Joi.string()
    .valid(...Object.values(incidentStatus))
    .optional(),
  incidentType: Joi.string().optional(),
  assignedTo: objectId.optional(),
  createdBy: objectId.optional(),
});

export const createIncidentNoteValidation = Joi.object({
  content: Joi.string().min(1).max(5000).required(),
  isInternal: Joi.boolean().default(true),
});

export const closeIncidentValidation = Joi.object({
  notes: Joi.string().max(5000).optional(),
  isFalsePositive: Joi.boolean().optional(),
  resolution: Joi.string().max(2000).optional(),
});

export const runIncidentPlaybookValidation = Joi.object({
  playbookId: objectId.required(),
  context: Joi.object().optional(),
});

// ─── Playbooks ───────────────────────────────────────────────────────────────

export const createPlaybookValidation = Joi.object({
  name: Joi.string().min(2).max(120).required(),
  description: Joi.string().max(2000).optional(),
  triggerType: Joi.string()
    .valid(...Object.values(playbookTrigger))
    .default(playbookTrigger.MANUAL),
  triggerCondition: Joi.string().optional(),
  actions: Joi.array().items(playbookActionSchema).min(1).required(),
  graph: Joi.object().optional(),
  isActive: Joi.boolean().optional(),
});

export const updatePlaybookValidation = Joi.object({
  name: Joi.string().min(2).max(120).optional(),
  description: Joi.string().max(2000).optional(),
  triggerType: Joi.string()
    .valid(...Object.values(playbookTrigger))
    .optional(),
  triggerCondition: Joi.string().allow(null, "").optional(),
  actions: Joi.array().items(playbookActionSchema).min(1).optional(),
  graph: Joi.object().optional(),
  isActive: Joi.boolean().optional(),
});

export const playbookIdValidation = Joi.object({
  id: objectId.required(),
});

export const playbookRunIdValidation = Joi.object({
  runId: objectId.required(),
});

export const executePlaybookValidation = Joi.object({
  incidentId: objectId.required(),
  context: Joi.object().optional(),
});

export const listPlaybooksValidation = listQueryValidation.keys({
  isActive: Joi.boolean().optional(),
  triggerType: Joi.string()
    .valid(...Object.values(playbookTrigger))
    .optional(),
});

export const listPlaybookRunsValidation = listQueryValidation.keys({
  incidentId: objectId.optional(),
  playbookId: objectId.optional(),
  status: Joi.string().optional(),
});

export const listConnectorsValidation = listQueryValidation.keys({
  type: Joi.string()
    .valid(...Object.values(connectorType))
    .optional(),
  isActive: Joi.boolean().optional(),
});

// ─── Artifacts ───────────────────────────────────────────────────────────────

export const createArtifactValidation = Joi.object({
  type: Joi.string()
    .valid(...Object.values(artifactType))
    .required(),
  value: Joi.string().min(1).max(2000).required(),
  label: Joi.string().max(200).optional(),
  source: Joi.string().max(200).optional(),
});

export const artifactIdValidation = Joi.object({
  id: objectId.required(),
});

export const enrichArtifactValidation = Joi.object({
  providers: Joi.array()
    .items(Joi.string().valid("opencti", "virustotal", "shodan", "custom"))
    .min(1)
    .optional(),
});

export const bulkEnrichArtifactsValidation = Joi.object({
  artifactIds: Joi.array().items(objectId).min(1).max(100).required(),
  providers: Joi.array()
    .items(Joi.string().valid("opencti", "virustotal", "shodan", "custom"))
    .min(1)
    .optional(),
});

// ─── Webhooks ────────────────────────────────────────────────────────────────

export const webhookPayloadValidation = Joi.object().unknown(true);

export const webhookQueryValidation = Joi.object({
  webhookSourceId: objectId.optional(),
  createIncident: Joi.boolean().optional(),
});

// ─── Connectors ──────────────────────────────────────────────────────────────

export const createConnectorValidation = Joi.object({
  name: Joi.string().min(2).max(120).required(),
  type: Joi.string()
    .valid(...Object.values(connectorType))
    .required(),
  config: Joi.object().optional(),
  vaultId: objectId.optional(),
  isActive: Joi.boolean().optional(),
});

export const updateConnectorValidation = Joi.object({
  name: Joi.string().min(2).max(120).optional(),
  type: Joi.string()
    .valid(...Object.values(connectorType))
    .optional(),
  config: Joi.object().optional(),
  vaultId: objectId.allow(null).optional(),
  isActive: Joi.boolean().optional(),
});

export const connectorIdValidation = Joi.object({
  id: objectId.required(),
});

export const listConnectorActionsValidation = listQueryValidation.keys({
  status: Joi.string().optional(),
});

// ─── Vault ───────────────────────────────────────────────────────────────────

export const createVaultValidation = Joi.object({
  name: Joi.string().min(2).max(120).required(),
  description: Joi.string().max(500).optional(),
  plaintext: Joi.string().min(1).required(),
});

export const updateVaultValidation = Joi.object({
  name: Joi.string().min(2).max(120).optional(),
  description: Joi.string().max(500).optional(),
  plaintext: Joi.string().min(1).optional(),
});

export const vaultIdValidation = Joi.object({
  id: objectId.required(),
});

// ─── Analytics ─────────────────────────────────────────────────────────────

export const exportAnalyticsValidation = Joi.object({
  format: Joi.string().valid("json", "csv", "pdf").default("json"),
  snapshotType: Joi.string()
    .valid("full", "kpis", "incidents", "playbooks")
    .default("full"),
  days: Joi.number().integer().min(1).max(365).default(30),
});

// ─── Notifications ───────────────────────────────────────────────────────────

export const notificationIdValidation = Joi.object({
  id: objectId.required(),
});

export const listNotificationsValidation = listQueryValidation.keys({
  isRead: Joi.string().valid("true", "false").optional(),
  type: Joi.string()
    .valid(...Object.values(notificationType))
    .optional(),
});

// ─── Integrations ────────────────────────────────────────────────────────────

export const grcFindingIntegrationValidation = Joi.object({
  incidentId: objectId.required(),
  title: Joi.string().optional(),
  description: Joi.string().optional(),
  severity: Joi.string()
    .valid(...Object.values(incidentSeverity))
    .optional(),
  createRisk: Joi.boolean().optional(),
  likelihood: Joi.number().min(1).max(5).optional(),
  impact: Joi.number().min(1).max(5).optional(),
});

export const grcRiskIntegrationValidation = Joi.object({
  incidentId: objectId.optional(),
  title: Joi.string().optional(),
  description: Joi.string().optional(),
  eventType: Joi.string().required(),
  owner: objectId.optional(),
  findingId: objectId.optional(),
});

export const uctcRuleIntegrationValidation = Joi.object({
  ruleId: objectId.required(),
  incidentId: objectId.optional(),
  context: Joi.object().optional(),
});

export const phishingCampaignIntegrationValidation = Joi.object({
  campaignId: objectId.required(),
  incidentId: objectId.optional(),
  action: Joi.string().valid("notify", "link", "report").optional(),
});

export const blockIpIntegrationValidation = Joi.object({
  ip: Joi.string()
    .ip({ version: ["ipv4", "ipv6"] })
    .optional(),
  sourceIP: Joi.string()
    .ip({ version: ["ipv4", "ipv6"] })
    .optional(),
  comment: Joi.string().max(500).optional(),
  incidentId: objectId.optional(),
  connectorId: objectId.optional(),
  async: Joi.boolean().optional(),
}).or("ip", "sourceIP");

export const isolateHostIntegrationValidation = Joi.object({
  host: Joi.string().optional(),
  affectedHost: Joi.string().optional(),
  os: Joi.string().valid("linux", "windows").optional(),
  incidentId: objectId.optional(),
  connectorId: objectId.optional(),
  async: Joi.boolean().optional(),
  forceDefault: Joi.boolean().optional(),
});

export const siemEventIntegrationValidation = Joi.object({
  incidentId: objectId.optional(),
  eventType: Joi.string().optional(),
  severity: Joi.string()
    .valid(...Object.values(incidentSeverity))
    .optional(),
  sourceIp: Joi.string().optional(),
  destinationIp: Joi.string().optional(),
  message: Joi.string().optional(),
  description: Joi.string().optional(),
  index: Joi.string().optional(),
  ruleName: Joi.string().optional(),
  alertId: Joi.string().optional(),
  metadata: Joi.object().optional(),
  timestamp: Joi.date().iso().optional(),
  async: Joi.boolean().optional(),
});
