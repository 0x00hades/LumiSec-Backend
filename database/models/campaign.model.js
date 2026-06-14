import { model, Schema } from "mongoose";
import { campaignStatus } from "../../src/utils/constant/enums.js";

const campaignSchema = new Schema({
    name: { type: String, required: true, trim: true },
    description: { type: String },
    templateId: { type: Schema.Types.ObjectId, ref: "EmailTemplate", required: true },
    landingPageId: { type: Schema.Types.ObjectId, ref: "LandingPage" },
    status: { type: String, enum: Object.values(campaignStatus), default: campaignStatus.DRAFT },
    launchDate: { type: Date },
    completedAt: { type: Date },
    recipientsCount: { type: Number, default: 0 },
    sentCount: { type: Number, default: 0 },
    openedCount: { type: Number, default: 0 },
    clickedCount: { type: Number, default: 0 },
    submittedCount: { type: Number, default: 0 },
    trackingDomain: { type: String },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true }
}, { timestamps: true });

campaignSchema.index({ status: 1 });
campaignSchema.index({ createdAt: -1 });
campaignSchema.index({ createdBy: 1 });

export const Campaign = model("Campaign", campaignSchema);
