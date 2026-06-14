import { model, Schema } from "mongoose";

const emailTemplateSchema = new Schema({
    name: { type: String, required: true, trim: true },
    subject: { type: String, required: true, trim: true },
    htmlBody: { type: String, required: true },
    textBody: { type: String },
    category: { type: String, trim: true },
    language: { type: String, default: "en", trim: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true }
}, { timestamps: true });

emailTemplateSchema.index({ name: 1 });
emailTemplateSchema.index({ category: 1 });

export const EmailTemplate = model("EmailTemplate", emailTemplateSchema);
