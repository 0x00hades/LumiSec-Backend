import {
  SoarAlert,
  WebhookSource,
  Incident,
} from "../../../../database/index.js";
import { AppError } from "../../../utils/appError.js";
import { messages } from "../../../utils/constant/messages.js";
import {
  alertSource,
  incidentSeverity,
  incidentStatus,
  entityType,
  auditAction,
  sourceModule,
} from "../../../utils/constant/enums.js";
import { auditCreate } from "../../../utils/auditLogger.js";
import { alertQueue } from "../../../utils/queue.js";
import { emitAlert } from "../../../utils/socket.js";
import { verifyWebhookSignature } from "../helpers/webhookAuth.js";
import * as incidentService from "./incident.service.js";

const SOURCE_NORMALIZERS = {
  [alertSource.CROWDSTRIKE]: normalizeCrowdStrike,
  [alertSource.FORTIGATE]: normalizeFortigate,
  [alertSource.WAZUH]: normalizeWazuh,
  [alertSource.DEFENDER]: normalizeDefender,
  [alertSource.SPLUNK]: normalizeSplunk,
  [alertSource.CUSTOM]: normalizeCustom,
};

const SEVERITY_MAP = {
  critical: incidentSeverity.CRITICAL,
  high: incidentSeverity.HIGH,
  medium: incidentSeverity.MEDIUM,
  low: incidentSeverity.LOW,
  informational: incidentSeverity.LOW,
  info: incidentSeverity.LOW,
};

function normalizeCrowdStrike(payload) {
  const detail = payload.event || payload;
  return {
    externalId:
      detail.event_id || detail.detection_id || payload.metadata?.eventUUID,
    title: detail.title || detail.description || "CrowdStrike detection",
    description: detail.description || detail.technique || "",
    severity: mapSeverity(
      detail.severity || detail.severity_name || payload.severity,
    ),
    sourceIP: detail.LocalIP || detail.external_ip || detail.source_ip,
    affectedHost: detail.ComputerName || detail.hostname,
    rawPayload: payload,
  };
}

function normalizeFortigate(payload) {
  const log = payload.log || payload;
  return {
    externalId: log.logid || log.eventtime || payload.id,
    title: log.msg || log.action || "FortiGate security event",
    description: log.msg || JSON.stringify(log),
    severity: mapSeverity(log.level || log.severity),
    sourceIP: log.srcip || log.src,
    affectedHost: log.devname || log.hostname,
    rawPayload: payload,
  };
}

function normalizeWazuh(payload) {
  const rule = payload.rule || {};
  const agent = payload.agent || {};
  const data = payload.data || {};
  return {
    externalId: payload.id || `${agent.id}-${payload.timestamp}`,
    title: rule.description || "Wazuh alert",
    description: rule.description || data.full_log,
    severity: mapSeverity(
      rule.level >= 12
        ? "critical"
        : rule.level >= 8
          ? "high"
          : rule.level >= 5
            ? "medium"
            : "low",
    ),
    sourceIP: data.srcip || agent.ip,
    affectedHost: agent.name,
    rawPayload: payload,
  };
}

function normalizeDefender(payload) {
  const alert = payload.alert || payload;
  return {
    externalId: alert.id || alert.alertId,
    title: alert.title || "Microsoft Defender alert",
    description: alert.description || alert.category,
    severity: mapSeverity(alert.severity),
    sourceIP: alert.evidence?.[0]?.ipAddress,
    affectedHost: alert.computerDnsName || alert.deviceName,
    rawPayload: payload,
  };
}

function normalizeSplunk(payload) {
  const result = payload.result || payload;
  return {
    externalId: result._cd || result._key || result.event_id,
    title: result.rule_name || result.search_name || "Splunk notable event",
    description: result._raw || result.message || result.description,
    severity: mapSeverity(result.severity || result.urgency),
    sourceIP: result.src_ip || result.src,
    affectedHost: result.dest || result.host,
    rawPayload: payload,
  };
}

function normalizeCustom(payload) {
  return {
    externalId: payload.externalId || payload.id,
    title: payload.title || "Custom webhook alert",
    description: payload.description || "",
    severity: mapSeverity(payload.severity),
    sourceIP: payload.sourceIP || payload.sourceIp,
    affectedHost: payload.affectedHost || payload.hostname,
    rawPayload: payload,
  };
}

function mapSeverity(value) {
  if (!value) return incidentSeverity.MEDIUM;
  const key = String(value).toLowerCase();
  return SEVERITY_MAP[key] || incidentSeverity.MEDIUM;
}

export const ingestWebhookAlert = async ({
  source,
  payload,
  signature,
  webhookSourceId,
  createIncident = true,
  user,
}) => {
  if (!Object.values(alertSource).includes(source)) {
    throw new AppError(`Unsupported alert source: ${source}`, 400);
  }

  let webhookSource = null;
  if (webhookSourceId) {
    webhookSource = await WebhookSource.findById(webhookSourceId);
    if (!webhookSource || !webhookSource.isActive) {
      throw new AppError("Webhook source not found or inactive", 404);
    }
  } else {
    webhookSource = await WebhookSource.findOne({ source, isActive: true });
  }

  if (webhookSource?.secret) {
    const valid = verifyWebhookSignature(
      payload,
      signature,
      webhookSource.secret,
    );
    if (!valid) throw new AppError("Invalid webhook signature", 401);
  }

  const normalizer = SOURCE_NORMALIZERS[source] || normalizeCustom;
  const normalized = normalizer(payload);

  if (normalized.externalId) {
    const duplicate = await SoarAlert.findOne({
      externalId: normalized.externalId,
      source,
    });
    if (duplicate) {
      return { alert: duplicate, duplicate: true };
    }
  }

  const alert = await SoarAlert.create({
    externalId: normalized.externalId,
    source,
    title: normalized.title,
    description: normalized.description,
    severity: normalized.severity,
    rawPayload: normalized.rawPayload,
    receivedAt: new Date(),
  });

  if (webhookSource) {
    webhookSource.lastReceivedAt = new Date();
    await webhookSource.save();
  }

  await alertQueue.add(
    "processSoarAlert",
    {
      alertId: alert._id,
      source,
      createIncident,
    },
    { attempts: 3, backoff: { type: "exponential", delay: 2000 } },
  );

  let incident = null;
  if (createIncident && user) {
    incident = await incidentService.createIncident(
      {
        title: normalized.title,
        description: normalized.description,
        severity: normalized.severity,
        sourceIP: normalized.sourceIP,
        affectedHost: normalized.affectedHost,
        incidentType: source,
        tags: [source, sourceModule.SOAR, "webhook"],
      },
      user,
    );

    alert.incidentId = incident._id;
    alert.processedAt = new Date();
    await alert.save();
  }

  if (user) {
    await auditCreate(user, entityType.SOAR_ALERT, alert);
  }

  emitAlert("soc_analyst", "alert:ingested", {
    alertId: alert._id,
    source,
    title: alert.title,
    severity: alert.severity,
    incidentId: incident?._id,
  });

  return { alert, incident, queued: true };
};

export const ingestCrowdStrikeAlert = (payload, opts) =>
  ingestWebhookAlert({ ...opts, source: alertSource.CROWDSTRIKE, payload });

export const ingestFortigateAlert = (payload, opts) =>
  ingestWebhookAlert({ ...opts, source: alertSource.FORTIGATE, payload });

export const ingestWazuhAlert = (payload, opts) =>
  ingestWebhookAlert({ ...opts, source: alertSource.WAZUH, payload });

export const ingestDefenderAlert = (payload, opts) =>
  ingestWebhookAlert({ ...opts, source: alertSource.DEFENDER, payload });

export const ingestSplunkAlert = (payload, opts) =>
  ingestWebhookAlert({ ...opts, source: alertSource.SPLUNK, payload });

export const ingestCustomAlert = (payload, opts) =>
  ingestWebhookAlert({ ...opts, source: alertSource.CUSTOM, payload });

export const listAlerts = async (query) => {
  const { parsePagination } = await import("../../../utils/pagination.js");
  const { page, limit, skip, sort } = parsePagination(query);
  const filter = {};

  if (query.source) filter.source = query.source;
  if (query.severity) filter.severity = query.severity;
  if (query.incidentId) filter.incidentId = query.incidentId;

  const [data, total] = await Promise.all([
    SoarAlert.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .populate("incidentId", "title status severity"),
    SoarAlert.countDocuments(filter),
  ]);

  return { data, page, limit, total };
};

export const getAlertById = async (id) => {
  const alert = await SoarAlert.findById(id).populate(
    "incidentId",
    "title status severity",
  );
  if (!alert) throw new AppError(messages.general.notFound, 404);
  return alert;
};

export const createWebhookSource = async (data, user) => {
  return WebhookSource.create({
    ...data,
    createdBy: user._id,
  });
};

export const listWebhookSources = async () => {
  return WebhookSource.find({ isActive: true })
    .select("-secret")
    .populate("createdBy", "name email");
};
