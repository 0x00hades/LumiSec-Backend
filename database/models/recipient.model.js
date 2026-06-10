import { model, Schema } from "mongoose";

const recipientSchema = new Schema({
    campaign: { type: Schema.Types.ObjectId, ref: "Campaign", required: true },
    email: { type: String, required: true },
    name: { type: String },
    department: { type: String },
    trackingId: { type: String, required: true, unique: true },
    riskScore: { type: Number, default: 100 },    // starts at 100, decreases on clicks
    emailSent: { type: Boolean, default: false },
    sentAt: { type: Date }
}, { timestamps: true });

export const Recipient = model("Recipient", recipientSchema);
