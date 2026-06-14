import { model, Schema } from "mongoose";

const analyticsSnapshotSchema = new Schema({
    snapshotType: { type: String, required: true, trim: true },
    period: { type: String, trim: true },
    data: { type: Schema.Types.Mixed, required: true },
    generatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

analyticsSnapshotSchema.index({ snapshotType: 1, generatedAt: -1 });

export const AnalyticsSnapshot = model("AnalyticsSnapshot", analyticsSnapshotSchema);
