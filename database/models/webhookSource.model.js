import { model, Schema } from "mongoose";
import { alertSource } from "../../src/utils/constant/enums.js";

const webhookSourceSchema = new Schema({
    name: { type: String, required: true, trim: true },
    source: { type: String, enum: Object.values(alertSource), required: true },
    secret: { type: String },
    isActive: { type: Boolean, default: true },
    lastReceivedAt: { type: Date },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true }
}, { timestamps: true });

webhookSourceSchema.index({ source: 1, isActive: 1 });

export const WebhookSource = model("WebhookSource", webhookSourceSchema);
