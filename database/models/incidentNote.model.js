import { model, Schema } from "mongoose";

const incidentNoteSchema = new Schema({
    incidentId: { type: Schema.Types.ObjectId, ref: "Incident", required: true },
    content: { type: String, required: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    isInternal: { type: Boolean, default: true }
}, { timestamps: true });

incidentNoteSchema.index({ incidentId: 1, createdAt: -1 });

export const IncidentNote = model("IncidentNote", incidentNoteSchema);
