import { model, Schema } from "mongoose";

const phishingSettingsSchema = new Schema({
    singletonKey: { type: String, default: "default", unique: true },
    fromAddress: { type: String, trim: true },
    trackingDomain: { type: String, trim: true }
}, { timestamps: true });

export const PhishingSettings = model("PhishingSettings", phishingSettingsSchema);
