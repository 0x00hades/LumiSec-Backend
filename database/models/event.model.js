import { model, Schema } from "mongoose";
import { phishingEventType } from "../../src/utils/constant/enums.js";

const phishingEventSchema = new Schema({
    campaignId: { type: Schema.Types.ObjectId, ref: "Campaign", required: true },
    recipientId: { type: Schema.Types.ObjectId, ref: "Recipient", required: true },
    eventType: { type: String, enum: Object.values(phishingEventType), required: true },
    ipAddress: { type: String },
    userAgent: { type: String },
    timestamp: { type: Date, default: Date.now },
    metadata: { type: Schema.Types.Mixed }
}, { timestamps: true });

phishingEventSchema.index({ campaignId: 1 });
phishingEventSchema.index({ recipientId: 1 });
phishingEventSchema.index({ eventType: 1 });
phishingEventSchema.index({ timestamp: -1 });
phishingEventSchema.index({ campaignId: 1, eventType: 1, timestamp: -1 });

export const PhishingEvent = model("PhishingEvent", phishingEventSchema);
