import { model, Schema } from "mongoose";
import { networkAssetStatus } from "../../src/utils/constant/enums.js";

/**
 * Stores LumiNet's current asset inventory from discovery and port scanning.
 */
const networkAssetSchema = new Schema({
    ip: { type: String, required: true, trim: true },
    mac: { type: String, required: true, uppercase: true, trim: true },
    hostname: { type: String, trim: true },
    osType: { type: String, trim: true },
    vendor: { type: String, trim: true },
    status: { type: String, enum: Object.values(networkAssetStatus), default: networkAssetStatus.ACTIVE },
    firstSeenAt: { type: Date, default: Date.now },
    lastSeenAt: { type: Date, default: Date.now },
    openPorts: [{
        port: Number,
        protocol: { type: String, default: "tcp" },
        service: String,
        banner: String,
        state: { type: String, default: "open" },
        detectedAt: { type: Date, default: Date.now }
    }],
    tags: [{ type: String, trim: true }],
    riskScore: { type: Number, default: 0 },
    metadata: { type: Schema.Types.Mixed }
}, { timestamps: true });

networkAssetSchema.index({ ip: 1 }, { unique: true });
networkAssetSchema.index({ mac: 1 });
networkAssetSchema.index({ status: 1, osType: 1 });
networkAssetSchema.index({ ip: 1, lastSeenAt: -1 });
networkAssetSchema.index({ hostname: "text", ip: "text", mac: "text", vendor: "text" });

export const NetworkAsset = model("NetworkAsset", networkAssetSchema);
