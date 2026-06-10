import { model, Schema } from "mongoose";

const uctcTuningSchema = new Schema({
    rule: { type: Schema.Types.ObjectId, ref: "SigmaRule", required: true },
    exclusionQuery: { type: String, required: true },
    reason: { type: String },
    status: { type: String, enum: ["active", "disabled"], default: "active" },
    appliedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    appliedAt: { type: Date, default: Date.now },
    disabledAt: { type: Date }
}, { timestamps: true });

uctcTuningSchema.index({ rule: 1, status: 1 });

export const UctcTuning = model("UctcTuning", uctcTuningSchema);
