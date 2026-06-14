import { model, Schema } from "mongoose";

const requirementControlMappingSchema = new Schema({
    requirementId: { type: Schema.Types.ObjectId, ref: "FrameworkRequirement", required: true },
    controlId: { type: Schema.Types.ObjectId, ref: "UnifiedControl", required: true }
}, { timestamps: true });

requirementControlMappingSchema.index({ requirementId: 1, controlId: 1 }, { unique: true });
requirementControlMappingSchema.index({ requirementId: 1 });
requirementControlMappingSchema.index({ controlId: 1 });

export const RequirementControlMapping = model("RequirementControlMapping", requirementControlMappingSchema);
