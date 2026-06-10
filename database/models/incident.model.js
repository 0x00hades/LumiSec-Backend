import { model, Schema } from "mongoose";
import { incidentStatus, incidentSeverity } from "../../src/utils/constant/enums.js";

const incidentSchema = new Schema({
    title: { type: String, required: true },
    description: { type: String },
    severity: { type: String, enum: Object.values(incidentSeverity), required: true },
    status: { type: String, enum: Object.values(incidentStatus), default: incidentStatus.NEW },
    assignedTo: { type: Schema.Types.ObjectId, ref: "User" },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    sourceIP: { type: String },
    affectedHost: { type: String },
    playbookExecuted: { type: Schema.Types.ObjectId, ref: "Playbook" },
    enrichment: { type: Schema.Types.Mixed },   // VirusTotal / OpenCTI data
    actions: [{
        action: String,
        performedAt: { type: Date, default: Date.now },
        performedBy: { type: Schema.Types.ObjectId, ref: "User" },
        result: String
    }],
    closedAt: { type: Date },
    notes: { type: String }
}, { timestamps: true });

export const Incident = model("Incident", incidentSchema);
