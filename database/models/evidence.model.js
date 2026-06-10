import { model, Schema } from "mongoose";

const evidenceSchema = new Schema({
    findingId: { type: Schema.Types.ObjectId, ref: "Finding", required: true },
    taskId: { type: Schema.Types.ObjectId, ref: "RemediationTask" },
    filename: { type: String, required: true },
    filePath: { type: String, required: true },
    mimeType: { type: String },
    size: { type: Number },
    uploadedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    uploadedAt: { type: Date, default: Date.now }
}, { timestamps: true });

evidenceSchema.index({ findingId: 1 });
evidenceSchema.index({ taskId: 1 });

export const Evidence = model("Evidence", evidenceSchema);
