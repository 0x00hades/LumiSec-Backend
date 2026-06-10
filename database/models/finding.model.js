import { model, Schema } from "mongoose";
import { findingStatus, sourceModule, severity, riskLevel } from "../../src/utils/constant/enums.js";

const findingSchema = new Schema({
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    sourceModule: { type: String, enum: Object.values(sourceModule), default: sourceModule.MANUAL },
    sourceId: { type: String },
    severity: { type: String, enum: Object.values(severity), required: true },
    riskRating: { type: String, enum: Object.values(riskLevel), required: true },
    asset: { type: String, trim: true },
    status: { type: String, enum: Object.values(findingStatus), default: findingStatus.OPEN },
    assignedTo: { type: Schema.Types.ObjectId, ref: "User" },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    closedBy: { type: Schema.Types.ObjectId, ref: "User" },
    dueDate: { type: Date },
    tags: [{ type: String, trim: true }],
    control: { type: String },
    auditReport: { type: Schema.Types.ObjectId, ref: "AuditReport" },
    closedAt: { type: Date }
}, { timestamps: true });

findingSchema.index({ status: 1, severity: 1 });
findingSchema.index({ sourceModule: 1, sourceId: 1 });
findingSchema.index({ asset: 1 });
findingSchema.index({ assignedTo: 1 });
findingSchema.index({ title: "text", description: "text", asset: "text" });

export const Finding = model("Finding", findingSchema);
