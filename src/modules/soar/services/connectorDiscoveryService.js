import { Connector } from "../../../../database/index.js";
import { logger } from "../../../utils/logger.js";
import {
    getConnectors,
    isConnectorEngineConfigured,
    logEngineClientEvent
} from "./connectorEngineClient.js";

const CACHE_TTL_MS = Number(process.env.CONNECTOR_DISCOVERY_CACHE_MS) || 300_000;

let metadataCache = {
    connectors: [],
    fetchedAt: 0
};

export const getCacheStatus = () => ({
    count: metadataCache.connectors.length,
    fetchedAt: metadataCache.fetchedAt
        ? new Date(metadataCache.fetchedAt).toISOString()
        : null,
    ttlMs: CACHE_TTL_MS
});

export const clearDiscoveryCache = () => {
    metadataCache = { connectors: [], fetchedAt: 0 };
};

/**
 * Fetch connector metadata from the Python Connector Engine.
 * Results are cached in memory for CONNECTOR_DISCOVERY_CACHE_MS.
 */
export const fetchConnectorMetadata = async ({ forceRefresh = false } = {}) => {
    const cacheValid =
        !forceRefresh
        && metadataCache.fetchedAt
        && Date.now() - metadataCache.fetchedAt < CACHE_TTL_MS;

    if (cacheValid) {
        return {
            connectors: metadataCache.connectors,
            cached: true,
            fetchedAt: metadataCache.fetchedAt
        };
    }

    if (!isConnectorEngineConfigured()) {
        return { connectors: [], cached: false, reason: "CONNECTOR_ENGINE_URL not set" };
    }

    const started = Date.now();
    const { connectors = [] } = await getConnectors();
    const durationMs = Date.now() - started;

    metadataCache = {
        connectors,
        fetchedAt: Date.now()
    };

    logEngineClientEvent("connector_discovery_fetch", {
        connectorCount: connectors.length,
        durationMs,
        status: "success"
    });

    return {
        connectors,
        cached: false,
        fetchedAt: metadataCache.fetchedAt,
        durationMs
    };
};

const resolveEngineMetadata = (connectors, record) => {
    const normalizedName = String(record.name || "").toLowerCase();
    return connectors.find((meta) => {
        const engineName = String(meta.name || "").toLowerCase();
        const alias = String(record.config?.engineAlias || "").toLowerCase();
        return engineName === normalizedName || (alias && engineName === alias);
    });
};

/**
 * Enrich existing Connector documents with engine metadata.
 * Does NOT create new connector records or modify core fields (name, type, vaultId).
 */
export const enrichExistingConnectors = async ({ forceRefresh = false } = {}) => {
    const { connectors } = await fetchConnectorMetadata({ forceRefresh });
    const existingRecords = await Connector.find({ isActive: true });
    const enriched = [];
    const skipped = [];

    for (const record of existingRecords) {
        const meta = resolveEngineMetadata(connectors, record);
        if (!meta) {
            skipped.push({ id: record._id, name: record.name, reason: "no_engine_match" });
            continue;
        }

        const previousConfig = record.config || {};
        const nextMetadata = {
            version: meta.version,
            description: meta.description,
            category: meta.category,
            actions: meta.actions || [],
            authTypes: meta.authTypes || [],
            status: meta.status || "active",
            engineName: meta.name,
            syncedAt: new Date().toISOString()
        };

        const unchanged = JSON.stringify(previousConfig.engineMetadata) === JSON.stringify(nextMetadata);
        if (unchanged) {
            skipped.push({ id: record._id, name: record.name, reason: "already_enriched" });
            continue;
        }

        record.config = {
            ...previousConfig,
            engineMetadata: nextMetadata
        };
        await record.save();
        enriched.push(record);

        logger.info({
            event: "connector_discovery_enrich",
            connector: record.name,
            engineName: meta.name,
            status: "success"
        });
    }

    return {
        enriched: enriched.length,
        skipped: skipped.length,
        connectors: enriched,
        details: { enriched, skipped }
    };
};

/**
 * Alias for enrich + fetch — sync metadata cache and enrich MongoDB records.
 */
export const syncConnectorMetadata = async (options = {}) => enrichExistingConnectors(options);
