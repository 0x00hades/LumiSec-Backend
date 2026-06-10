import { model, Schema } from "mongoose";
import { riskStatus, riskLevel, riskTreatment } from "../../src/utils/constant/enums.js";

const calculateRiskLevel = (score) => {
    if (score >= 15) return riskLevel.CRITICAL;
    if (score >= 10) return riskLevel.HIGH;
    if (score >= 5) return riskLevel.MEDIUM;
    return riskLevel.LOW;
};

const riskSchema = new Schema({
    findingId: { type: Schema.Types.ObjectId, ref: "Finding" },
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    likelihood: { type: Number, required: true, min: 1, max: 5 },
    impact: { type: Number, required: true, min: 1, max: 5 },
    score: { type: Number, min: 1, max: 25 },
    riskLevel: { type: String, enum: Object.values(riskLevel) },
    treatment: { type: String, enum: Object.values(riskTreatment), default: riskTreatment.MITIGATE },
    owner: { type: Schema.Types.ObjectId, ref: "User", required: true },
    status: { type: String, enum: Object.values(riskStatus), default: riskStatus.OPEN },
    acceptedBy: { type: Schema.Types.ObjectId, ref: "User" },
    acceptedAt: { type: Date },
    closedAt: { type: Date }
}, { timestamps: true });

riskSchema.pre("save", function (next) {
    if (this.likelihood && this.impact) {
        this.score = this.likelihood * this.impact;
        this.riskLevel = calculateRiskLevel(this.score);
    }
    next();
});

riskSchema.index({ status: 1, riskLevel: 1 });
riskSchema.index({ findingId: 1 });
riskSchema.index({ owner: 1 });

export const Risk = model("Risk", riskSchema);
