import { model, Schema } from "mongoose";
import { networkScanStatus, networkScanType } from "../../src/utils/constant/enums.js";

/**
 * Tracks each discovery or port-scan request and the assets/results it produced.
 */
const networkScanSchema = new Schema({
    type: { type: String, enum: Object.values(networkScanType), required: true },
    status: { type: String, enum: Object.values(networkScanStatus), default: networkScanStatus.QUEUED },
    target: { type: String, required: true, trim: true },
    ports: { type: String, trim: true },
    scanMode: { type: String, trim: true },
    requestedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    startedAt: { type: Date },
    completedAt: { type: Date },
    durationMs: { type: Number },
    discoveredAssets: [{ type: Schema.Types.ObjectId, ref: "NetworkAsset" }],
    resultSummary: { type: Schema.Types.Mixed },
    error: { type: String },
    // INFRA/CLOUD INTEGRATION: Store the external scanner/cloud worker job ID here when scans become asynchronous.
    runnerJobId: { type: String },
    // INFRA/CLOUD INTEGRATION: Tracks whether results came from mock mode, local Nmap, or a future cloud scanner.
    runnerProvider: { type: String, default: "mock" }
}, { timestamps: true });

networkScanSchema.index({ type: 1, status: 1, createdAt: -1 });
networkScanSchema.index({ target: 1 });
networkScanSchema.index({ requestedBy: 1 });

export const NetworkScan = model("NetworkScan", networkScanSchema);
