import { model, Schema } from "mongoose";
import { ruleStatus } from "../../src/utils/constant/enums.js";

const sigmaRuleSchema = new Schema({
    title: { type: String, required: true },
    description: { type: String },
    status: { type: String, enum: Object.values(ruleStatus), default: ruleStatus.DRAFT },
    rawSigma: { type: String, required: true },   // raw YAML sigma rule
    convertedQuery: { type: String },             // converted for target SIEM
    targetSiem: { type: String },                 // splunk | elastic | sentinel
    mitreTactics: [{ type: String }],
    mitreTechniques: [{ type: String }],
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    approvedBy: { type: Schema.Types.ObjectId, ref: "User" },
    deployedAt: { type: Date },
    retiredAt: { type: Date },
    falsePositiveRate: { type: Number, default: 0 },
    lastAlertAt: { type: Date }
}, { timestamps: true });

export const SigmaRule = model("SigmaRule", sigmaRuleSchema);
