import axios from "axios";
import axiosRetry from "axios-retry";
import { logger } from "../../../utils/logger.js";

const DEFAULT_TIMEOUT_MS = Number(process.env.CONNECTOR_ENGINE_TIMEOUT_MS) || 15000;

let requestImpl = null;

const buildClient = () => {
    const client = axios.create({
        baseURL: process.env.CONNECTOR_ENGINE_URL || "http://localhost:4101",
        timeout: DEFAULT_TIMEOUT_MS,
        headers: {
            "Content-Type": "application/json",
            ...(process.env.CONNECTOR_ENGINE_API_KEY
                ? { "X-Api-Key": process.env.CONNECTOR_ENGINE_API_KEY }
                : {})
        }
    });

    axiosRetry(client, {
        retries: Number(process.env.CONNECTOR_ENGINE_RETRY_COUNT) || 2,
        retryDelay: axiosRetry.exponentialDelay,
        retryCondition: (error) => {
            const status = error.response?.status;
            return !status || status >= 500;
        }
    });

    return client;
};

const getClient = () => {
    if (requestImpl) return { request: requestImpl };
    return buildClient();
};

/**
 * SOAR_CONNECTOR_MODE=local|engine (default: local)
 * When local, callers keep using existing in-process integrations.
 */
export const getConnectorMode = () =>
    (process.env.SOAR_CONNECTOR_MODE || "local").toLowerCase();

export const isEngineMode = () => getConnectorMode() === "engine";

export const isConnectorEngineConfigured = () =>
    Boolean(process.env.CONNECTOR_ENGINE_URL);

export const isConnectorEngineEnabled = () =>
    isEngineMode() && isConnectorEngineConfigured();

const engineRequest = async (method, path, data) => {
    if (requestImpl) {
        return requestImpl(method, path, data);
    }

    const client = buildClient();
    const response = await client.request({ method, url: path, data });
    return response.data;
};

export const getHealth = async () => {
    try {
        return await engineRequest("get", "/health");
    } catch {
        return await engineRequest("get", "/api/v1/health");
    }
};

export const getConnectors = async () =>
    engineRequest("get", "/api/v1/connectors");

export const testConnector = async (connectorName, { config = {} } = {}) =>
    engineRequest("post", `/api/v1/connectors/${connectorName}/test`, { config });

export const executeConnectorAction = async ({
    connector,
    action,
    params = {},
    config = {},
    context = {}
}) =>
    engineRequest("post", "/api/v1/connectors/execute", {
        connector,
        action,
        params,
        config,
        context
    });

/** @internal Test hook — does not affect production callers */
export const configureEngineClientForTests = (impl) => {
    requestImpl = impl;
};

/** @internal Test hook */
export const resetEngineClientForTests = () => {
    requestImpl = null;
};

export const logEngineClientEvent = (event, meta = {}) => {
    logger.info({ event, service: "connectorEngineClient", ...meta });
};
