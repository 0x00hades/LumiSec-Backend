import { model, Schema } from "mongoose";
import { severity } from "../../src/utils/constant/enums.js";

/**
 * Stores weak services and risky network configuration findings from scans.
 */
const networkMisconfigurationSchema = new Schema({
    asset: { type: Schema.Types.ObjectId, ref: "NetworkAsset", required: true },
    assetIp: { type: String, required: true, trim: true },
    assetMac: { type: String, required: true, uppercase: true, trim: true },
    type: { type: String, required: true, trim: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    severity: { type: String, enum: Object.values(severity), required: true },
    evidence: { type: Schema.Types.Mixed },
    recommendation: { type: String },
    status: { type: String, enum: ["open", "accepted", "resolved"], default: "open" },
    detectedAt: { type: Date, default: Date.now },
    // INFRA/CLOUD INTEGRATION: Store linked GRC finding/risk IDs after auto-log integration is enabled.
    grcReferenceId: { type: String }
}, { timestamps: true });

networkMisconfigurationSchema.index({ asset: 1, status: 1 });
networkMisconfigurationSchema.index({ severity: 1, detectedAt: -1 });
networkMisconfigurationSchema.index({ type: 1 });

export const NetworkMisconfiguration = model("NetworkMisconfiguration", networkMisconfigurationSchema);
