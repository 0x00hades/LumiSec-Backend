import { model, Schema } from "mongoose";
import { alertSource, incidentSeverity } from "../../src/utils/constant/enums.js";

const soarAlertSchema = new Schema({
    externalId: { type: String, trim: true },
    source: { type: String, enum: Object.values(alertSource), required: true },
    title: { type: String, required: true },
    description: { type: String },
    severity: { type: String, enum: Object.values(incidentSeverity), default: incidentSeverity.MEDIUM },
    rawPayload: { type: Schema.Types.Mixed },
    incidentId: { type: Schema.Types.ObjectId, ref: "Incident" },
    processedAt: { type: Date },
    receivedAt: { type: Date, default: Date.now }
}, { timestamps: true });

soarAlertSchema.index({ source: 1, receivedAt: -1 });
soarAlertSchema.index({ incidentId: 1 });
soarAlertSchema.index({ externalId: 1, source: 1 });

export const SoarAlert = model("SoarAlert", soarAlertSchema);
