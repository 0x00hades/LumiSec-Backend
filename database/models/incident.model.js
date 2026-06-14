import { model, Schema } from "mongoose";
import { incidentStatus, incidentSeverity } from "../../src/utils/constant/enums.js";

const incidentSchema = new Schema({
    title: { type: String, required: true, trim: true },
    description: { type: String },
    severity: { type: String, enum: Object.values(incidentSeverity), required: true },
    status: { type: String, enum: Object.values(incidentStatus), default: incidentStatus.NEW },
    incidentType: { type: String, trim: true },
    assignedTo: { type: Schema.Types.ObjectId, ref: "User" },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    sourceIP: { type: String },
    affectedHost: { type: String },
    tags: [{ type: String }],
    relatedIncidents: [{ type: Schema.Types.ObjectId, ref: "Incident" }],
    enrichment: { type: Schema.Types.Mixed },
    closedAt: { type: Date },
    resolvedAt: { type: Date },
    deletedAt: { type: Date }
}, { timestamps: true });

incidentSchema.index({ status: 1, severity: 1, createdAt: -1 });
incidentSchema.index({ assignedTo: 1 });
incidentSchema.index({ createdBy: 1 });
incidentSchema.index({ deletedAt: 1 });

incidentSchema.pre(/^find/, function (next) {
    if (!this.getOptions().includeDeleted) {
        this.where({ deletedAt: null });
    }
    next();
});

export const Incident = model("Incident", incidentSchema);
