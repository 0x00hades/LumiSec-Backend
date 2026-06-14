import { model, Schema } from "mongoose";
import { severity } from "../../src/utils/constant/enums.js";

/**
 * Stores traffic flow metrics used for overflow and anomaly detection.
 */
const networkFlowMetricSchema = new Schema({
    sourceIp: { type: String, required: true, trim: true },
    destinationIp: { type: String, trim: true },
    protocol: { type: String, trim: true },
    packetsPerSecond: { type: Number, default: 0 },
    bandwidthKbps: { type: Number, default: 0 },
    baselinePacketsPerSecond: { type: Number, default: 0 },
    thresholdPacketsPerSecond: { type: Number, default: 0 },
    isAnomaly: { type: Boolean, default: false },
    severity: { type: String, enum: Object.values(severity), default: severity.LOW },
    observedAt: { type: Date, default: Date.now },
    // INFRA/CLOUD INTEGRATION: Store SIEM/SOAR alert IDs after overflow alerts are pushed outward.
    externalAlertId: { type: String }
}, { timestamps: true });

networkFlowMetricSchema.index({ observedAt: -1 });
networkFlowMetricSchema.index({ sourceIp: 1, isAnomaly: 1 });
networkFlowMetricSchema.index({ severity: 1 });

export const NetworkFlowMetric = model("NetworkFlowMetric", networkFlowMetricSchema);
