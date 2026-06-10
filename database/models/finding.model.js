import { model, Schema } from "mongoose";
import { findingStatus } from "../../src/utils/constant/enums.js";

const findingSchema = new Schema({
    title: { type: String, required: true },
    description: { type: String, required: true },
    status: { type: String, enum: Object.values(findingStatus), default: findingStatus.OPEN },
    riskRating: { type: String, enum: ["low", "medium", "high", "critical"], required: true },
    severity: { type: Number, min: 1, max: 10 },
    control: { type: String },
    auditReport: { type: Schema.Types.ObjectId, ref: "AuditReport" },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },  // auditor
    closedBy: { type: Schema.Types.ObjectId, ref: "User" },
    closedAt: { type: Date },
    retestResult: { type: String, enum: ["effective", "ineffective"] }
}, { timestamps: true });

export const Finding = model("Finding", findingSchema);
