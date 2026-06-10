import { model, Schema } from "mongoose";
import { taskStatus, taskPriority } from "../../src/utils/constant/enums.js";

const remediationTaskSchema = new Schema({
    findingId: { type: Schema.Types.ObjectId, ref: "Finding", required: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    assignedTo: { type: Schema.Types.ObjectId, ref: "User", required: true },
    assignedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    dueDate: { type: Date },
    priority: { type: String, enum: Object.values(taskPriority), default: taskPriority.MEDIUM },
    status: { type: String, enum: Object.values(taskStatus), default: taskStatus.OPEN },
    completedAt: { type: Date },
    verifiedBy: { type: Schema.Types.ObjectId, ref: "User" },
    verifiedAt: { type: Date }
}, { timestamps: true });

remediationTaskSchema.index({ findingId: 1, status: 1 });
remediationTaskSchema.index({ assignedTo: 1, status: 1 });
remediationTaskSchema.index({ priority: 1, dueDate: 1 });

export const RemediationTask = model("RemediationTask", remediationTaskSchema);
