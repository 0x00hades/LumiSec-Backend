import { model, Schema } from "mongoose";
import { artifactType } from "../../src/utils/constant/enums.js";

const artifactSchema = new Schema({
    incidentId: { type: Schema.Types.ObjectId, ref: "Incident", required: true },
    type: { type: String, enum: Object.values(artifactType), required: true },
    value: { type: String, required: true, trim: true },
    label: { type: String, trim: true },
    source: { type: String, trim: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
    deletedAt: { type: Date }
}, { timestamps: true });

artifactSchema.index({ incidentId: 1 });
artifactSchema.index({ type: 1, value: 1 });
artifactSchema.index({ deletedAt: 1 });

artifactSchema.pre(/^find/, function (next) {
    if (!this.getOptions().includeDeleted) {
        this.where({ deletedAt: null });
    }
    next();
});

export const Artifact = model("Artifact", artifactSchema);
