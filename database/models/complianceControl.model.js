import { model, Schema } from "mongoose";
import { complianceFramework, controlStatus } from "../../src/utils/constant/enums.js";

const complianceControlSchema = new Schema({
    framework: { type: String, enum: Object.values(complianceFramework), required: true },
    controlId: { type: String, required: true, trim: true },
    title: { type: String, required: true, trim: true },
    description: { type: String },
    status: { type: String, enum: Object.values(controlStatus), default: controlStatus.NOT_ASSESSED },
    linkedFindings: [{ type: Schema.Types.ObjectId, ref: "Finding" }]
}, { timestamps: true });

complianceControlSchema.index({ framework: 1, controlId: 1 }, { unique: true });
complianceControlSchema.index({ status: 1 });

export const ComplianceControl = model("ComplianceControl", complianceControlSchema);
