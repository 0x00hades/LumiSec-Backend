import { model, Schema } from "mongoose";
import { ruleStatus } from "../../src/utils/constant/enums.js";

const sigmaRuleSchema = new Schema({
    title: { type: String, required: true },
    description: { type: String },
    sigmaId: { type: String },
    status: { type: String, enum: Object.values(ruleStatus), default: ruleStatus.DRAFT },
    rawSigma: { type: String, required: true },   // raw YAML sigma rule
    parsedSigma: { type: Schema.Types.Mixed },    // parsed YAML snapshot used by the UI and workers
    convertedQuery: { type: String },             // legacy single-target query for existing callers
    convertedQueries: {
        type: Map,
        of: String,
        default: {}
    },
    targetSiem: { type: String },                 // preferred target: splunk | elastic | sentinel
    targets: [{ type: String }],
    logsource: {
        product: { type: String },
        category: { type: String },
        service: { type: String }
    },
    level: { type: String },
    author: { type: String },
    references: [{ type: String }],
    tags: [{ type: String }],
    mitreTactics: [{ type: String }],
    mitreTechniques: [{ type: String }],
    validation: {
        isValid: { type: Boolean, default: false },
        errors: [{ type: Schema.Types.Mixed }],
        warnings: [{ type: Schema.Types.Mixed }],
        validatedAt: { type: Date }
    },
    tuning: {
        totalAlerts: { type: Number, default: 0 },
        falsePositiveCount: { type: Number, default: 0 },
        truePositiveCount: { type: Number, default: 0 },
        estimatedMinutesWasted: { type: Number, default: 0 },
        exclusions: [{
            query: String,
            reason: String,
            appliedBy: { type: Schema.Types.ObjectId, ref: "User" },
            appliedAt: { type: Date, default: Date.now }
        }]
    },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
    approvedBy: { type: Schema.Types.ObjectId, ref: "User" },
    deploymentNote: { type: String },
    convertedAt: { type: Date },
    deployedAt: { type: Date },
    retiredAt: { type: Date },
    falsePositiveRate: { type: Number, default: 0 },
    lastAlertAt: { type: Date }
}, { timestamps: true });

sigmaRuleSchema.index({ title: "text", description: "text", rawSigma: "text", tags: "text" });

export const SigmaRule = model("SigmaRule", sigmaRuleSchema);
