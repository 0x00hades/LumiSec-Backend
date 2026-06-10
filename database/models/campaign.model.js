import { model, Schema } from "mongoose";
import { campaignStatus } from "../../src/utils/constant/enums.js";

const campaignSchema = new Schema({
    name: { type: String, required: true },
    description: { type: String },
    status: { type: String, enum: Object.values(campaignStatus), default: campaignStatus.DRAFT },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    template: {
        subject: { type: String, required: true },
        senderName: { type: String, required: true },
        senderEmail: { type: String, required: true },
        htmlBody: { type: String, required: true }
    },
    landingPageUrl: { type: String },
    trackingDomain: { type: String },
    totalSent: { type: Number, default: 0 },
    stats: {
        opens: { type: Number, default: 0 },
        clicks: { type: Number, default: 0 },
        submissions: { type: Number, default: 0 }
    },
    launchedAt: { type: Date },
    completedAt: { type: Date }
}, { timestamps: true });

export const Campaign = model("Campaign", campaignSchema);
