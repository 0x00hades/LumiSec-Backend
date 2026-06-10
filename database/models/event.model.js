import { model, Schema } from "mongoose";
import { phishingEventType } from "../../src/utils/constant/enums.js";

const phishingEventSchema = new Schema({
    recipient: { type: Schema.Types.ObjectId, ref: "Recipient", required: true },
    campaign: { type: Schema.Types.ObjectId, ref: "Campaign", required: true },
    type: { type: String, enum: Object.values(phishingEventType), required: true },
    ipAddress: { type: String },
    userAgent: { type: String },
    submittedData: { type: Schema.Types.Mixed },  // credentials submitted (hashed/masked)
    penalty: { type: Number, default: 0 }
}, { timestamps: true });

export const PhishingEvent = model("PhishingEvent", phishingEventSchema);
