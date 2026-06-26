import { model, Schema } from "mongoose";
import { networkScanStatus, networkScanType } from "../../src/utils/constant/enums.js";

const SCAN_MODES = ["CONNECT", "SYN", "UDP"];

/**
 * Tracks each discovery or port-scan request and the assets/results it produced.
 */
const networkScanSchema = new Schema({
    type: { type: String, enum: Object.values(networkScanType), required: true },
    status: { type: String, enum: Object.values(networkScanStatus), default: networkScanStatus.QUEUED },
    target: { type: String, required: true, trim: true },
    ports: {
        type: [Number],
        validate: {
            validator(value) {
                if (this.type !== networkScanType.PORT_SCAN) return true;
                return Array.isArray(value) && value.length > 0;
            },
            message: "ports is required for port scan records"
        }
    },
    scanMode: {
        type: String,
        enum: SCAN_MODES,
        default: "CONNECT"
    },
    requestedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    startedAt: { type: Date },
    completedAt: { type: Date },
    durationMs: { type: Number },
    discoveredAssets: [{ type: Schema.Types.ObjectId, ref: "NetworkAsset" }],
    resultSummary: { type: Schema.Types.Mixed },
    error: { type: String },
    runnerJobId: { type: String },
    runnerProvider: { type: String, default: "local" }
}, { timestamps: true });

networkScanSchema.index({ type: 1, status: 1, createdAt: -1 });
networkScanSchema.index({ target: 1 });
networkScanSchema.index({ requestedBy: 1 });

export const NetworkScan = model("NetworkScan", networkScanSchema);
