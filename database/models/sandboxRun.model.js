import { model, Schema } from "mongoose";
import { sandboxRunStatus, sandboxRunType } from "../../src/utils/constant/enums.js";

const sandboxRunSchema = new Schema({
    type: { type: String, enum: Object.values(sandboxRunType), required: true },
    status: { type: String, enum: Object.values(sandboxRunStatus), default: sandboxRunStatus.QUEUED },
    language: { type: String, enum: ["powershell", "python", "bash"], required: true },
    scenarioId: { type: String },
    scenarioName: { type: String },
    script: { type: String, required: true },
    timeoutSec: { type: Number, default: 30 },
    // INFRA/CLOUD INTEGRATION: Identifies whether a run used mock, local Docker, or a future remote cloud runner.
    runnerProvider: { type: String },
    // INFRA/CLOUD INTEGRATION: Store the remote cloud job/container ID here when sandbox execution moves off-host.
    runnerJobId: { type: String },
    dockerImage: { type: String },
    dockerCommand: [{ type: String }],
    output: { type: String },
    error: { type: String },
    exitCode: { type: Number },
    durationMs: { type: Number },
    requestedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    startedAt: { type: Date },
    completedAt: { type: Date }
}, { timestamps: true });

sandboxRunSchema.index({ createdAt: -1 });
sandboxRunSchema.index({ scenarioId: 1 });

export const SandboxRun = model("SandboxRun", sandboxRunSchema);
