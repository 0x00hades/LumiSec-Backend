import { model, Schema } from "mongoose";

const credentialCaptureSchema = new Schema({
    campaignId: { type: Schema.Types.ObjectId, ref: "Campaign", required: true },
    recipientId: { type: Schema.Types.ObjectId, ref: "Recipient", required: true },
    username: { type: String, trim: true },
    timestamp: { type: Date, default: Date.now }
}, { timestamps: true });

credentialCaptureSchema.index({ campaignId: 1 });
credentialCaptureSchema.index({ recipientId: 1 });

export const CredentialCapture = model("CredentialCapture", credentialCaptureSchema);
