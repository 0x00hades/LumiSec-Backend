import { model, Schema } from "mongoose";

const unifiedControlSchema = new Schema({
    controlCode: { type: String, required: true, trim: true, uppercase: true },
    title: { type: String, required: true, trim: true },
    description: { type: String },
    category: { type: String, trim: true }
}, { timestamps: true });

unifiedControlSchema.index({ controlCode: 1 }, { unique: true });

export const UnifiedControl = model("UnifiedControl", unifiedControlSchema);
