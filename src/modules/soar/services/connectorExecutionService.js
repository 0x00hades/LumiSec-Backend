import {
    Connector, CredentialVault, IntegrationAction
} from "../../../../database/index.js";
import { integrationActionStatus } from "../../../utils/constant/enums.js";
import { logger } from "../../../utils/logger.js";
import { decryptSecret } from "../helpers/vaultCrypto.js";
import * as engineClient from "./connectorEngineClient.js";

const normalizeEngineResponse = (payload = {}) => ({
    success: Boolean(payload.success),
    connector: payload.connector,
    action: payload.action,
    data: payload.data ?? payload,
    error: payload.error ?? null,
    mode: payload.mode || "engine"
});

export const buildConnectorConfig = async (connectorId, connectorRecord = null) => {
    const record = connectorRecord
        || (connectorId ? await Connector.findById(connectorId) : null);

    if (!record) return {};

    const base = record.config || {};
    if (!record.vaultId) return base;

    const vault = await CredentialVault.findById(record.vaultId);
    if (!vault) return base;

    const secret = decryptSecret({
        encryptedValue: vault.encryptedValue,
        iv: vault.iv,
        authTag: vault.authTag
    });

    try {
        return { ...base, ...JSON.parse(secret) };
    } catch {
        return { ...base, token: secret, apiKey: secret };
    }
};

const resolveEngineConnectorName = ({ connector, connectorId, connectorRecord }) => {
    if (connector) return connector;

    const record = connectorRecord;
    if (!record) return null;

    return record.config?.engineMetadata?.engineName
        || record.config?.engineAlias
        || record.name;
};

const logConnectorAudit = async ({
    connector,
    action,
    durationMs,
    status,
    user,
    connectorId,
    incidentId,
    playbookRunId,
    request,
    response
}) => {
    logger.info({
        event: "connector_engine_audit",
        connector,
        action,
        durationMs,
        status
    });

    await IntegrationAction.create({
        name: `Engine ${connector}.${action}`,
        connectorId,
        incidentId,
        playbookRunId,
        status: status === "success"
            ? integrationActionStatus.SUCCESS
            : integrationActionStatus.FAILED,
        request: { ...request, durationMs, executionMode: engineClient.getConnectorMode() },
        response,
        executedBy: user?._id,
        executedAt: new Date()
    });
};

/**
 * Optional execution backend for connector actions.
 *
 * local mode (default): returns { mode: "local", executed: false } so callers
 * continue using existing in-process integrations unchanged.
 *
 * engine mode: calls Python Connector Engine; on failure returns failover hint.
 */
export const executeConnectorAction = async ({
    connectorId,
    connector,
    connectorRecord = null,
    action,
    params = {},
    context = {},
    user,
    incidentId,
    playbookRunId
}) => {
    const started = Date.now();
    const mode = engineClient.getConnectorMode();

    const record = connectorRecord
        || (connectorId ? await Connector.findById(connectorId) : null);
    const engineName = resolveEngineConnectorName({ connector, connectorId, connectorRecord: record });
    const config = await buildConnectorConfig(connectorId, record);

    const baseResult = {
        connector: engineName,
        action,
        mode,
        executed: false,
        durationMs: 0
    };

    if (mode !== "engine") {
        return {
            ...baseResult,
            mode: "local",
            config
        };
    }

    if (!engineClient.isConnectorEngineConfigured()) {
        return {
            ...baseResult,
            mode: "local",
            failover: true,
            reason: "CONNECTOR_ENGINE_URL not configured"
        };
    }

    if (!engineName || !action) {
        return {
            ...baseResult,
            mode: "engine-failed",
            failover: true,
            error: "connector and action are required for engine execution"
        };
    }

    const request = { connector: engineName, action, params, config, context };

    try {
        const raw = await engineClient.executeConnectorAction(request);
        const durationMs = Date.now() - started;
        const normalized = normalizeEngineResponse(raw);

        await logConnectorAudit({
            connector: engineName,
            action,
            durationMs,
            status: normalized.success ? "success" : "failed",
            user,
            connectorId: record?._id,
            incidentId,
            playbookRunId,
            request,
            response: normalized
        });

        return {
            ...normalized,
            executed: true,
            durationMs
        };
    } catch (error) {
        const durationMs = Date.now() - started;

        await logConnectorAudit({
            connector: engineName,
            action,
            durationMs,
            status: "failed",
            user,
            connectorId: record?._id,
            incidentId,
            playbookRunId,
            request,
            response: { error: error.message }
        });

        logger.warn({
            event: "connector_engine_failover",
            connector: engineName,
            action,
            durationMs,
            error: error.message
        });

        return {
            ...baseResult,
            mode: "engine-failed",
            executed: false,
            failover: true,
            error: error.message,
            durationMs
        };
    }
};

/**
 * Test a connector instance via the Python engine when SOAR_CONNECTOR_MODE=engine.
 * In local mode returns { mode: "local", delegated: false }.
 */
export const testConnectorViaEngine = async (connectorId, user) => {
    const started = Date.now();
    const record = await Connector.findById(connectorId);
    if (!record) {
        return { mode: engineClient.getConnectorMode(), delegated: false, error: "Connector not found" };
    }

    if (engineClient.getConnectorMode() !== "engine") {
        return { mode: "local", delegated: false };
    }

    const engineName = resolveEngineConnectorName({ connectorRecord: record });
    const config = await buildConnectorConfig(connectorId, record);

    try {
        const result = await engineClient.testConnector(engineName, { config });
        const durationMs = Date.now() - started;

        await logConnectorAudit({
            connector: engineName,
            action: "test",
            durationMs,
            status: result.success === false ? "failed" : "success",
            user,
            connectorId: record._id,
            request: { action: "test", engineName },
            response: result
        });

        return { mode: "engine", delegated: true, durationMs, ...result };
    } catch (error) {
        const durationMs = Date.now() - started;

        await logConnectorAudit({
            connector: engineName,
            action: "test",
            durationMs,
            status: "failed",
            user,
            connectorId: record._id,
            request: { action: "test", engineName },
            response: { error: error.message }
        });

        return {
            mode: "engine-failed",
            delegated: false,
            failover: true,
            durationMs,
            error: error.message
        };
    }
};
