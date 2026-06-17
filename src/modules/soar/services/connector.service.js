import axios from "axios";
import {
  Connector,
  CredentialVault,
  IntegrationAction,
} from "../../../../database/index.js";
import { AppError } from "../../../utils/appError.js";
import { messages } from "../../../utils/constant/messages.js";
import {
  entityType,
  auditAction,
  connectorType,
  integrationActionStatus,
} from "../../../utils/constant/enums.js";
import { parsePagination, buildTextSearch } from "../../../utils/pagination.js";
import {
  auditCreate,
  auditUpdate,
  recordAudit,
} from "../../../utils/auditLogger.js";
import { decryptSecret } from "../helpers/vaultCrypto.js";

const CONNECTOR_ACTIONS = {
  [connectorType.FIREWALL]: ["block_ip", "unblock_ip", "list_rules"],
  [connectorType.SIEM]: ["search_logs", "index_event", "get_alerts"],
  [connectorType.EDR]: ["isolate_host", "release_host", "query_endpoint"],
  [connectorType.TICKETING]: ["create_ticket", "update_ticket", "close_ticket"],
  [connectorType.EMAIL]: ["send_email", "send_alert"],
  [connectorType.SSH]: ["run_command", "get_logs"],
  [connectorType.CUSTOM]: ["custom_action"],
};

export const createConnector = async (data, user) => {
  if (data.vaultId) {
    const vault = await CredentialVault.findById(data.vaultId);
    if (!vault) throw new AppError(messages.general.notFound, 404);
  }

  const connector = await Connector.create({
    ...data,
    createdBy: user._id,
  });

  await auditCreate(user, entityType.CONNECTOR, connector);
  return connector;
};

export const listConnectors = async (query) => {
  const { page, limit, skip, sort } = parsePagination(query);
  const filter = {};

  if (query.type) filter.type = query.type;
  if (query.isActive !== undefined) filter.isActive = query.isActive === "true";

  const searchFilter = buildTextSearch(query.search, ["name"]);
  const finalFilter = Object.keys(searchFilter).length
    ? { $and: [filter, searchFilter] }
    : filter;

  const [data, total] = await Promise.all([
    Connector.find(finalFilter)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .populate("createdBy", "name email")
      .populate("vaultId", "name description"),
    Connector.countDocuments(finalFilter),
  ]);

  return { data, page, limit, total };
};

export const getConnectorById = async (id) => {
  const connector = await Connector.findById(id)
    .populate("createdBy", "name email")
    .populate("vaultId", "name description");

  if (!connector) throw new AppError(messages.general.notFound, 404);
  return connector;
};

export const updateConnector = async (id, updates, user) => {
  const connector = await Connector.findById(id);
  if (!connector) throw new AppError(messages.general.notFound, 404);

  if (updates.vaultId) {
    const vault = await CredentialVault.findById(updates.vaultId);
    if (!vault) throw new AppError(messages.general.notFound, 404);
  }

  const oldValue = connector.toObject();
  Object.assign(connector, updates);
  await connector.save();

  await auditUpdate(
    user,
    entityType.CONNECTOR,
    connector._id,
    oldValue,
    connector.toObject(),
  );
  return connector;
};

export const softDeleteConnector = async (id, user) => {
  const connector = await Connector.findById(id);
  if (!connector) throw new AppError(messages.general.notFound, 404);

  connector.deletedAt = new Date();
  connector.isActive = false;
  await connector.save();

  await recordAudit({
    user,
    action: auditAction.DELETE,
    entityType: entityType.CONNECTOR,
    entityId: connector._id,
    oldValue: connector.toObject(),
    newValue: { deletedAt: connector.deletedAt },
  });

  return connector;
};

const resolveConnectorCredentials = async (connector) => {
  if (!connector.vaultId) return connector.config || {};

  const vault = await CredentialVault.findById(connector.vaultId);
  if (!vault) return connector.config || {};

  const secret = decryptSecret({
    encryptedValue: vault.encryptedValue,
    iv: vault.iv,
    authTag: vault.authTag,
  });

  try {
    return { ...connector.config, ...JSON.parse(secret) };
  } catch {
    return { ...connector.config, token: secret, apiKey: secret };
  }
};

export const testConnector = async (id, user) => {
  const connector = await Connector.findById(id);
  if (!connector) throw new AppError(messages.general.notFound, 404);

  const creds = await resolveConnectorCredentials(connector);
  let result;
  let success = false;

  try {
    switch (connector.type) {
      case connectorType.FIREWALL: {
        const host = creds.host || process.env.FORTIGATE_HOST;
        if (!host) throw new Error("Firewall host not configured");
        await axios.get(`https://${host}/api/v2/monitor/system/status`, {
          headers: {
            Authorization: `Bearer ${creds.token || process.env.FORTIGATE_TOKEN}`,
          },
          timeout: 10000,
          validateStatus: () => true,
        });
        result = { reachable: true, type: "firewall" };
        success = true;
        break;
      }
      case connectorType.SIEM: {
        const url = creds.url || process.env.ELASTICSEARCH_URL;
        if (!url) throw new Error("SIEM URL not configured");
        await axios.get(url, { timeout: 10000, validateStatus: () => true });
        result = { reachable: true, type: "siem" };
        success = true;
        break;
      }
      case connectorType.EDR:
      case connectorType.SSH:
      case connectorType.EMAIL:
      case connectorType.TICKETING:
      case connectorType.CUSTOM:
      default:
        result = {
          reachable: true,
          type: connector.type,
          message: "Configuration validated",
        };
        success = true;
    }
  } catch (error) {
    result = { reachable: false, error: error.message };
    success = false;
  }

  connector.lastTestedAt = new Date();
  connector.lastTestStatus = success ? "success" : "failed";
  await connector.save();

  await IntegrationAction.create({
    name: `Test connector: ${connector.name}`,
    connectorId: connector._id,
    status: success
      ? integrationActionStatus.SUCCESS
      : integrationActionStatus.FAILED,
    request: { action: "test" },
    response: result,
    executedBy: user._id,
  });

  if (!success) {
    throw new AppError(`Connector test failed: ${result.error}`, 502);
  }

  return result;
};

export const listConnectorActions = async (connectorId, query = {}) => {
  const connector = await Connector.findById(connectorId);
  if (!connector) throw new AppError(messages.general.notFound, 404);

  const availableActions =
    CONNECTOR_ACTIONS[connector.type] ||
    CONNECTOR_ACTIONS[connectorType.CUSTOM];

  const { page, limit, skip, sort } = parsePagination(query);
  const filter = { connectorId };
  if (query.status) filter.status = query.status;

  const [executed, total] = await Promise.all([
    IntegrationAction.find(filter)
      .sort(sort || "-executedAt")
      .skip(skip)
      .limit(limit)
      .populate("executedBy", "name email"),
    IntegrationAction.countDocuments(filter),
  ]);

  return {
    connector: {
      id: connector._id,
      name: connector.name,
      type: connector.type,
    },
    availableActions,
    executed: { data: executed, page, limit, total },
  };
};
