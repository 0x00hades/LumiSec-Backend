import { model, Schema } from "mongoose";

const auditReportSchema = new Schema({
    title: { type: String, required: true },
    scope: { type: String },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },   // lead auditor
    approvedBy: { type: Schema.Types.ObjectId, ref: "User" },                  // compliance manager
    findings: [{ type: Schema.Types.ObjectId, ref: "Finding" }],
    summary: { type: String },
    status: { type: String, enum: ["draft", "under_review", "approved", "published"], default: "draft" },
    approvedAt: { type: Date }
}, { timestamps: true });

export const AuditReport = model("AuditReport", auditReportSchema);
