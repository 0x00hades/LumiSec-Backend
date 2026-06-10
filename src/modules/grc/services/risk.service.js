import { Risk } from "../../../../database/index.js";
import { AppError } from "../../../utils/appError.js";
import { messages } from "../../../utils/constant/messages.js";
import { riskStatus, entityType, auditAction, notificationType } from "../../../utils/constant/enums.js";
import { parsePagination, buildTextSearch } from "../../../utils/pagination.js";
import { auditCreate, auditUpdate, recordAudit } from "../../../utils/auditLogger.js";
import { createNotification } from "../../../utils/notificationHelper.js";

export const createRisk = async (data, user) => {
    const risk = await Risk.create({ ...data, owner: data.owner || user._id });
    await auditCreate(user, entityType.RISK, risk);

    await createNotification({
        userId: risk.owner,
        title: "New risk registered",
        message: `Risk "${risk.title}" (${risk.riskLevel}) requires attention`,
        type: notificationType.RISK,
        entityType: entityType.RISK,
        entityId: risk._id
    });

    return risk;
};

export const listRisks = async (query) => {
    const { page, limit, skip, sort } = parsePagination(query);
    const filter = {};
    if (query.status) filter.status = query.status;
    if (query.riskLevel) filter.riskLevel = query.riskLevel;
    if (query.owner) filter.owner = query.owner;
    if (query.findingId) filter.findingId = query.findingId;

    const searchFilter = buildTextSearch(query.search, ["title", "description"]);
    const finalFilter = Object.keys(searchFilter).length ? { $and: [filter, searchFilter] } : filter;

    const [data, total] = await Promise.all([
        Risk.find(finalFilter).sort(sort).skip(skip).limit(limit).populate("owner", "name email").populate("findingId", "title"),
        Risk.countDocuments(finalFilter)
    ]);

    return { data, page, limit, total };
};

export const getRiskById = async (id) => {
    const risk = await Risk.findById(id).populate("owner", "name email").populate("findingId", "title status");
    if (!risk) throw new AppError(messages.risk.notFound, 404);
    return risk;
};

export const updateRisk = async (id, updates, user) => {
    const risk = await Risk.findById(id);
    if (!risk) throw new AppError(messages.risk.notFound, 404);

    const oldValue = risk.toObject();
    Object.assign(risk, updates);
    await risk.save();

    await auditUpdate(user, entityType.RISK, risk._id, oldValue, risk.toObject());
    return risk;
};

export const acceptRisk = async (id, user) => {
    const risk = await Risk.findById(id);
    if (!risk) throw new AppError(messages.risk.notFound, 404);

    const oldValue = { status: risk.status };
    risk.status = riskStatus.ACCEPTED;
    risk.treatment = "accept";
    risk.acceptedBy = user._id;
    risk.acceptedAt = new Date();
    await risk.save();

    await recordAudit({ user, action: auditAction.ACCEPT, entityType: entityType.RISK, entityId: risk._id, oldValue, newValue: { status: riskStatus.ACCEPTED } });
    return risk;
};

export const mitigateRisk = async (id, user) => {
    const risk = await Risk.findById(id);
    if (!risk) throw new AppError(messages.risk.notFound, 404);

    const oldValue = { status: risk.status };
    risk.status = riskStatus.MITIGATED;
    await risk.save();

    await recordAudit({ user, action: auditAction.MITIGATE, entityType: entityType.RISK, entityId: risk._id, oldValue, newValue: { status: riskStatus.MITIGATED } });
    return risk;
};

export const closeRisk = async (id, user) => {
    const risk = await Risk.findById(id);
    if (!risk) throw new AppError(messages.risk.notFound, 404);

    const oldValue = { status: risk.status };
    risk.status = riskStatus.CLOSED;
    risk.closedAt = new Date();
    await risk.save();

    await recordAudit({ user, action: auditAction.CLOSE, entityType: entityType.RISK, entityId: risk._id, oldValue, newValue: { status: riskStatus.CLOSED } });
    return risk;
};
