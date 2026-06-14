import { model, Schema } from "mongoose";

const attachmentSchema = new Schema({
    campaignId: { type: Schema.Types.ObjectId, ref: "Campaign", required: true },
    filename: { type: String, required: true, trim: true },
    storagePath: { type: String, required: true },
    type: { type: String, trim: true }
}, { timestamps: true });

attachmentSchema.index({ campaignId: 1 });

export const Attachment = model("Attachment", attachmentSchema);
