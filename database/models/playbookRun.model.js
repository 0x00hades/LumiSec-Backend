import { model, Schema } from "mongoose";
import { playbookRunStatus } from "../../src/utils/constant/enums.js";

const playbookRunSchema = new Schema({
    playbookId: { type: Schema.Types.ObjectId, ref: "Playbook", required: true },
    incidentId: { type: Schema.Types.ObjectId, ref: "Incident", required: true },
    status: { type: String, enum: Object.values(playbookRunStatus), default: playbookRunStatus.QUEUED },
    startedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    startedAt: { type: Date },
    completedAt: { type: Date },
    context: { type: Schema.Types.Mixed },
    error: { type: String }
}, { timestamps: true });

playbookRunSchema.index({ incidentId: 1, status: 1 });
playbookRunSchema.index({ playbookId: 1, createdAt: -1 });

export const PlaybookRun = model("PlaybookRun", playbookRunSchema);
