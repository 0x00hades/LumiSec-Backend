import {
    fetchConnectorMetadata,
    getCacheStatus
} from "./connectorDiscoveryService.js";
import {
    getConnectorMode,
    getHealth,
    isConnectorEngineConfigured,
    isEngineMode
} from "./connectorEngineClient.js";

export const checkEngineAvailability = async () => {
    if (!isConnectorEngineConfigured()) {
        return {
            available: false,
            mode: getConnectorMode(),
            reason: "CONNECTOR_ENGINE_URL not configured"
        };
    }

    const started = Date.now();

    try {
        const health = await getHealth();
        return {
            available: true,
            mode: getConnectorMode(),
            durationMs: Date.now() - started,
            health
        };
    } catch (error) {
        return {
            available: false,
            mode: getConnectorMode(),
            durationMs: Date.now() - started,
            error: error.message
        };
    }
};

export const checkConnectorAvailability = async (connectorName) => {
    const engineStatus = await checkEngineAvailability();

    if (!engineStatus.available) {
        return {
            connector: connectorName,
            available: false,
            catalogMatch: false,
            engine: engineStatus
        };
    }

    const { connectors = [] } = await fetchConnectorMetadata();
    const meta = connectors.find(
        (entry) => String(entry.name).toLowerCase() === String(connectorName).toLowerCase()
    );

    return {
        connector: connectorName,
        available: Boolean(meta) && (meta.status || "active") !== "deprecated",
        catalogMatch: Boolean(meta),
        status: meta?.status || "unknown",
        actions: meta?.actions || [],
        engine: { available: true }
    };
};

export const getHealthSummary = async () => {
    const engine = await checkEngineAvailability();
    const cache = getCacheStatus();

    return {
        connectorMode: getConnectorMode(),
        engineModeActive: isEngineMode(),
        engineConfigured: isConnectorEngineConfigured(),
        engine,
        discoveryCache: cache
    };
};
