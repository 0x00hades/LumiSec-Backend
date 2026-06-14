import { model, Schema } from "mongoose";
import { phishingRiskLevel } from "../../src/utils/constant/enums.js";

const phishingRiskSchema = new Schema({
    recipientId: { type: Schema.Types.ObjectId, ref: "Recipient", required: true },
    campaignId: { type: Schema.Types.ObjectId, ref: "Campaign", required: true },
    riskLevel: { type: String, enum: Object.values(phishingRiskLevel), required: true },
    reason: { type: String, required: true },
    grcRiskId: { type: Schema.Types.ObjectId, ref: "Risk" }
}, { timestamps: true });

phishingRiskSchema.index({ recipientId: 1 });
phishingRiskSchema.index({ riskLevel: 1 });
phishingRiskSchema.index({ campaignId: 1 });

export const PhishingRisk = model("PhishingRisk", phishingRiskSchema);
