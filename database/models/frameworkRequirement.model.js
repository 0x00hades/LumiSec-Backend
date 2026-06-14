import { model, Schema } from "mongoose";

const frameworkRequirementSchema = new Schema({
    frameworkId: { type: Schema.Types.ObjectId, ref: "Framework", required: true },
    requirementId: { type: String, required: true, trim: true },
    domain: { type: String, trim: true },
    controlText: { type: String },
    weight: { type: Number, default: 0 },
    complianceThreshold: { type: Number, default: 0 },
    maturityLevel: { type: String, trim: true },
    evidenceMapping: {
        siemEvents: [{ type: String }],
        tools: [{ type: String }]
    }
}, { timestamps: true });

frameworkRequirementSchema.index({ frameworkId: 1, requirementId: 1 }, { unique: true });
frameworkRequirementSchema.index({ requirementId: 1 });
frameworkRequirementSchema.index({ frameworkId: 1, domain: 1 });

export const FrameworkRequirement = model("FrameworkRequirement", frameworkRequirementSchema);
