import { model, Schema } from "mongoose";
import { auditAction, entityType } from "../../src/utils/constant/enums.js";

const auditLogSchema = new Schema({
    user: { type: Schema.Types.ObjectId, ref: "User" },
    action: { type: String, enum: Object.values(auditAction), required: true },
    entityType: { type: String, enum: Object.values(entityType), required: true },
    entityId: { type: Schema.Types.ObjectId, required: true },
    oldValue: { type: Schema.Types.Mixed },
    newValue: { type: Schema.Types.Mixed },
    timestamp: { type: Date, default: Date.now }
}, { timestamps: false });

auditLogSchema.index({ entityType: 1, entityId: 1, timestamp: -1 });
auditLogSchema.index({ user: 1, timestamp: -1 });
auditLogSchema.index({ action: 1 });

export const AuditLog = model("AuditLog", auditLogSchema);
