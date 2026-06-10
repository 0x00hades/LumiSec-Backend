import { AuditLog } from "../../database/index.js";
import { auditAction } from "./constant/enums.js";

export const recordAudit = async ({ user, action, entityType, entityId, oldValue = null, newValue = null }) => {
    await AuditLog.create({
        user: user?._id || user,
        action,
        entityType,
        entityId,
        oldValue,
        newValue,
        timestamp: new Date()
    });
};

export const auditCreate = (user, entityType, entity) =>
    recordAudit({ user, action: auditAction.CREATE, entityType, entityId: entity._id, newValue: entity.toObject?.() || entity });

export const auditUpdate = (user, entityType, entityId, oldValue, newValue) =>
    recordAudit({ user, action: auditAction.UPDATE, entityType, entityId, oldValue, newValue });

export const auditDelete = (user, entityType, entity) =>
    recordAudit({ user, action: auditAction.DELETE, entityType, entityId: entity._id, oldValue: entity.toObject?.() || entity });
