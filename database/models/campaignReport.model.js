import { model, Schema } from "mongoose";

const campaignReportSchema = new Schema({
    campaignId: { type: Schema.Types.ObjectId, ref: "Campaign", required: true },
    generatedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    pdfPath: { type: String },
    generatedAt: { type: Date, default: Date.now },
    stats: {
        emailsSent: { type: Number, default: 0 },
        opened: { type: Number, default: 0 },
        clicked: { type: Number, default: 0 },
        submitted: { type: Number, default: 0 },
        openRate: { type: Number, default: 0 },
        clickRate: { type: Number, default: 0 },
        submissionRate: { type: Number, default: 0 }
    }
}, { timestamps: true });

campaignReportSchema.index({ campaignId: 1 });
campaignReportSchema.index({ generatedAt: -1 });

export const CampaignReport = model("CampaignReport", campaignReportSchema);
