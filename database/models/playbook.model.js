import { model, Schema } from "mongoose";
import { playbookTrigger } from "../../src/utils/constant/enums.js";

const actionSchema = new Schema(
  {
    id: { type: String, required: true },
    type: { type: String, required: true },
    params: { type: Schema.Types.Mixed },
    order: { type: Number, required: true },
    nextOnSuccess: { type: String },
    nextOnFailure: { type: String },
    condition: { type: String },
  },
  { _id: false },
);

const playbookSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String },
    version: { type: Number, default: 1 },
    triggerType: {
      type: String,
      enum: Object.values(playbookTrigger),
      default: playbookTrigger.MANUAL,
    },
    triggerCondition: { type: String },
    actions: [actionSchema],
    graph: { type: Schema.Types.Mixed },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    isActive: { type: Boolean, default: true },
    deletedAt: { type: Date },
  },
  { timestamps: true },
);

playbookSchema.index(
  { name: 1 },
  { unique: true, partialFilterExpression: { deletedAt: null } },
);
playbookSchema.index({ isActive: 1 });
playbookSchema.index({ deletedAt: 1 });

playbookSchema.pre(/^find/, function (next) {
  if (!this.getOptions().includeDeleted) {
    this.where({ deletedAt: null });
  }
  next();
});

export const Playbook = model("Playbook", playbookSchema);
