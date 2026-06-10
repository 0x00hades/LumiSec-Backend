import { model, Schema } from "mongoose";
import { complianceFramework } from "../../src/utils/constant/enums.js";

const auditReportSchema = new Schema({
    title: { type: String, required: true, trim: true },
    framework: { type: String, enum: Object.values(complianceFramework), required: true },
    scope: { type: String },
    findings: [{ type: Schema.Types.ObjectId, ref: "Finding" }],
    generatedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    generatedAt: { type: Date, default: Date.now },
    pdfPath: { type: String },
    summary: { type: String },
    status: { type: String, enum: ["draft", "generating", "ready", "published"], default: "draft" },
    approvedBy: { type: Schema.Types.ObjectId, ref: "User" },
    approvedAt: { type: Date }
}, { timestamps: true });

auditReportSchema.index({ framework: 1, status: 1 });
auditReportSchema.index({ generatedBy: 1 });

export const AuditReport = model("AuditReport", auditReportSchema);
