import { AuditLog } from "../../../../database/index.js";
import { parsePagination } from "../../../utils/pagination.js";

export const listAuditLogs = async (query) => {
    const { page, limit, skip, sort } = parsePagination(query);
    const filter = {};
    if (query.action) filter.action = query.action;
    if (query.entityType) filter.entityType = query.entityType;
    if (query.user) filter.user = query.user;

    const [data, total] = await Promise.all([
        AuditLog.find(filter).sort(sort === "-createdAt" ? { timestamp: -1 } : sort).skip(skip).limit(limit).populate("user", "name email role"),
        AuditLog.countDocuments(filter)
    ]);

    return { data, page, limit, total };
};

export const getEntityAuditLogs = async (entityType, entityId) => {
    return AuditLog.find({ entityType, entityId })
        .sort({ timestamp: -1 })
        .populate("user", "name email role");
};
