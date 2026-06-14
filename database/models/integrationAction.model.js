import { model, Schema } from "mongoose";
import { integrationActionStatus } from "../../src/utils/constant/enums.js";

const integrationActionSchema = new Schema({
    name: { type: String, required: true, trim: true },
    connectorId: { type: Schema.Types.ObjectId, ref: "Connector" },
    incidentId: { type: Schema.Types.ObjectId, ref: "Incident" },
    playbookRunId: { type: Schema.Types.ObjectId, ref: "PlaybookRun" },
    status: { type: String, enum: Object.values(integrationActionStatus), default: integrationActionStatus.PENDING },
    request: { type: Schema.Types.Mixed },
    response: { type: Schema.Types.Mixed },
    executedBy: { type: Schema.Types.ObjectId, ref: "User" },
    executedAt: { type: Date, default: Date.now }
}, { timestamps: true });

integrationActionSchema.index({ incidentId: 1, executedAt: -1 });
integrationActionSchema.index({ status: 1 });

export const IntegrationAction = model("IntegrationAction", integrationActionSchema);
