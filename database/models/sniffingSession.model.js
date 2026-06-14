import { model, Schema } from "mongoose";
import { sniffingSessionStatus } from "../../src/utils/constant/enums.js";

/**
 * Stores packet-capture sessions and sample packets for audit and live traffic views.
 */
const sniffingSessionSchema = new Schema({
    interfaceName: { type: String, required: true, trim: true },
    durationSec: { type: Number, default: 300 },
    filter: { type: String, trim: true },
    status: { type: String, enum: Object.values(sniffingSessionStatus), default: sniffingSessionStatus.RUNNING },
    requestedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    startedAt: { type: Date, default: Date.now },
    completedAt: { type: Date },
    packetCount: { type: Number, default: 0 },
    byteCount: { type: Number, default: 0 },
    samplePackets: [{ type: Schema.Types.Mixed }],
    // INFRA/CLOUD INTEGRATION: Store remote packet-capture process/container ID when live sniffing moves to cloud workers.
    runnerJobId: { type: String },
    // INFRA/CLOUD INTEGRATION: mock/local-libpcap/cloud-runner value used by dashboard health checks.
    runnerProvider: { type: String, default: "mock" },
    error: { type: String }
}, { timestamps: true });

sniffingSessionSchema.index({ status: 1, createdAt: -1 });
sniffingSessionSchema.index({ requestedBy: 1 });

export const SniffingSession = model("SniffingSession", sniffingSessionSchema);
