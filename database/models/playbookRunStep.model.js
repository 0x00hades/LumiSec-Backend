import { model, Schema } from "mongoose";
import { playbookStepStatus } from "../../src/utils/constant/enums.js";

const playbookRunStepSchema = new Schema({
    runId: { type: Schema.Types.ObjectId, ref: "PlaybookRun", required: true },
    stepIndex: { type: Number, required: true },
    actionId: { type: String, required: true },
    actionType: { type: String, required: true },
    status: { type: String, enum: Object.values(playbookStepStatus), default: playbookStepStatus.PENDING },
    result: { type: Schema.Types.Mixed },
    error: { type: String },
    startedAt: { type: Date },
    completedAt: { type: Date },
    retryCount: { type: Number, default: 0 }
}, { timestamps: true });

playbookRunStepSchema.index({ runId: 1, stepIndex: 1 });

export const PlaybookRunStep = model("PlaybookRunStep", playbookRunStepSchema);
