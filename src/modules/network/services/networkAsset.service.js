import { NetworkAsset } from "../../../../database/index.js";
import { networkAssetStatus } from "../../../utils/constant/enums.js";
import { logger } from "../../../utils/logger.js";

const normalizeMac = (mac) => String(mac || "").toUpperCase().trim();

/**
 * Normalizes inbound asset payloads from discovery and port-scan providers.
 */
export const normalizeAssetPayload = (assetData = {}) => {
    const ip = String(assetData.ip || "").trim();
    if (!ip) {
        throw new Error("Network asset ip is required");
    }

    return {
        ip,
        mac: normalizeMac(assetData.mac),
        hostname: assetData.hostname ?? null,
        osType: assetData.osType || "unknown",
        vendor: assetData.vendor ?? null,
        status: assetData.status || networkAssetStatus.ACTIVE,
        openPorts: assetData.openPorts,
        tags: assetData.tags,
        riskScore: assetData.riskScore,
        metadata: assetData.metadata
    };
};

const buildAssetSetFields = (assetData) => {
    const fields = {
        ip: assetData.ip,
        mac: assetData.mac,
        osType: assetData.osType,
        status: assetData.status,
        lastSeenAt: new Date()
    };

    if (assetData.hostname !== undefined) fields.hostname = assetData.hostname;
    if (assetData.vendor !== undefined) fields.vendor = assetData.vendor;
    if (assetData.openPorts !== undefined) fields.openPorts = assetData.openPorts;
    if (assetData.tags !== undefined) fields.tags = assetData.tags;
    if (assetData.riskScore !== undefined) fields.riskScore = assetData.riskScore;
    if (assetData.metadata !== undefined) fields.metadata = assetData.metadata;

    return fields;
};

const isDuplicateKeyError = (error) =>
    error?.code === 11000 || error?.name === "MongoServerError" && error?.code === 11000;

/**
 * Idempotently persists a network asset keyed by IP.
 */
export const upsertNetworkAsset = async (assetData) => {
    const normalized = normalizeAssetPayload(assetData);
    const existing = await NetworkAsset.findOne({ ip: normalized.ip });

    if (existing) {
        logger.info({
            event: "network_asset_found",
            ip: normalized.ip,
            assetId: existing._id,
            mac: existing.mac
        });
    }

    try {
        const asset = await NetworkAsset.findOneAndUpdate(
            { ip: normalized.ip },
            {
                $set: buildAssetSetFields(normalized),
                $setOnInsert: { firstSeenAt: new Date() }
            },
            {
                upsert: true,
                new: true,
                runValidators: true
            }
        );

        logger.info({
            event: existing ? "network_asset_updated" : "network_asset_inserted",
            ip: normalized.ip,
            assetId: asset._id,
            mac: asset.mac
        });

        return asset;
    } catch (error) {
        if (!isDuplicateKeyError(error)) throw error;

        logger.warn({
            event: "network_asset_duplicate_key_recovered",
            ip: normalized.ip,
            keyPattern: error.keyPattern,
            message: error.message
        });

        const recovered = await NetworkAsset.findOneAndUpdate(
            { ip: normalized.ip },
            { $set: buildAssetSetFields(normalized) },
            { new: true, runValidators: true }
        );

        if (!recovered) {
            throw error;
        }

        logger.info({
            event: "network_asset_updated",
            ip: normalized.ip,
            assetId: recovered._id,
            recoveredFromDuplicateKey: true
        });

        return recovered;
    }
};
