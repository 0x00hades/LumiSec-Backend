import { model, Schema } from "mongoose";
import { severity } from "../../src/utils/constant/enums.js";

const siemAlertSchema = new Schema({
    alertId: { type: String, required: true, unique: true },
    ruleName: { type: String, required: true },
    severity: { type: String, enum: Object.values(severity), required: true },
    sourceIp: { type: String },
    destinationIp: { type: String },
    indexName: { type: String },
    findingId: { type: Schema.Types.ObjectId, ref: "Finding" },
    receivedAt: { type: Date, default: Date.now }
}, { timestamps: true });

siemAlertSchema.index({ severity: 1, receivedAt: -1 });
siemAlertSchema.index({ findingId: 1 });

export const SiemAlert = model("SiemAlert", siemAlertSchema);
