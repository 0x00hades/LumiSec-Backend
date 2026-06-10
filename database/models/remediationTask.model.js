import { model, Schema } from "mongoose";

const remediationTaskSchema = new Schema({
    finding: { type: Schema.Types.ObjectId, ref: "Finding", required: true },
    assignedTo: { type: Schema.Types.ObjectId, ref: "User", required: true },   // assignee
    assignedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },   // IT manager
    description: { type: String, required: true },
    dueDate: { type: Date },
    evidence: [{
        url: { type: String },
        filename: { type: String },
        uploadedAt: { type: Date, default: Date.now }
    }],
    itValidation: {
        validated: { type: Boolean, default: false },
        validatedBy: { type: Schema.Types.ObjectId, ref: "User" },
        validatedAt: { type: Date },
        notes: { type: String }
    },
    completedAt: { type: Date }
}, { timestamps: true });

export const RemediationTask = model("RemediationTask", remediationTaskSchema);
