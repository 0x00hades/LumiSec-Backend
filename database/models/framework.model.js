import { model, Schema } from "mongoose";

const frameworkSchema = new Schema({
    name: { type: String, required: true, trim: true },
    version: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    metadata: { type: Schema.Types.Mixed, default: {} }
}, { timestamps: true });

frameworkSchema.index({ name: 1, version: 1 }, { unique: true });
frameworkSchema.index({ name: 1 });

export const Framework = model("Framework", frameworkSchema);
