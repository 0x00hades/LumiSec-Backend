import { model, Schema } from "mongoose";
import { recipientStatus } from "../../src/utils/constant/enums.js";

const recipientSchema = new Schema({
    campaignId: { type: Schema.Types.ObjectId, ref: "Campaign" },
    fullName: { type: String, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    department: { type: String, trim: true },
    jobTitle: { type: String, trim: true },
    manager: { type: String, trim: true },
    riskScore: { type: Number, default: 100 },
    status: { type: String, enum: Object.values(recipientStatus), default: recipientStatus.PENDING },
    trackingId: { type: String, required: true },
    emailSent: { type: Boolean, default: false },
    opened: { type: Boolean, default: false },
    clicked: { type: Boolean, default: false },
    submitted: { type: Boolean, default: false },
    sentAt: { type: Date },
    clickCount: { type: Number, default: 0 }
}, { timestamps: true });

recipientSchema.index({ email: 1 });
recipientSchema.index({ trackingId: 1 }, { unique: true });
recipientSchema.index({ campaignId: 1 });
recipientSchema.index({ campaignId: 1, emailSent: 1 });

export const Recipient = model("Recipient", recipientSchema);
