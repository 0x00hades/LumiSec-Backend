import { model, Schema } from "mongoose";
import { playbookTrigger } from "../../src/utils/constant/enums.js";

const actionSchema = new Schema({
    type: { type: String, required: true },  // block_ip | isolate_host | enrich | notify | ssh_command
    params: { type: Schema.Types.Mixed },
    order: { type: Number, required: true }
}, { _id: false });

const playbookSchema = new Schema({
    name: { type: String, required: true, unique: true },
    description: { type: String },
    triggerType: { type: String, enum: Object.values(playbookTrigger), default: playbookTrigger.MANUAL },
    triggerCondition: { type: String },  // e.g. severity === "critical"
    actions: [actionSchema],
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    isActive: { type: Boolean, default: true }
}, { timestamps: true });

export const Playbook = model("Playbook", playbookSchema);
