import { Finding, AuditReport } from "../../../../database/index.js";
import { AppError } from "../../../utils/appError.js";
import { messages } from "../../../utils/constant/messages.js";
import { findingStatus, entityType, auditAction, notificationType, sourceModule } from "../../../utils/constant/enums.js";
import { parsePagination, buildTextSearch } from "../../../utils/pagination.js";
import { auditCreate, auditUpdate, auditDelete, recordAudit } from "../../../utils/auditLogger.js";
import { createNotification } from "../../../utils/notificationHelper.js";
import { withTransaction } from "../../../utils/transaction.js";

export const createFinding = async (data, user, options = {}) => {
    if (data.sourceModule && data.sourceId) {
        const existing = await Finding.findOne({
            sourceModule: data.sourceModule,
            sourceId: data.sourceId
        });
        if (existing) return existing;
    }

    const payload = {
        ...data,
        sourceModule: data.sourceModule || sourceModule.MANUAL,
        createdBy: user._id
    };

    const runCreate = async (session) => {
        const createOpts = session ? { session } : {};
        const [finding] = await Finding.create([payload], createOpts);

        if (data.auditReportId) {
            await AuditReport.findByIdAndUpdate(
                data.auditReportId,
                { $push: { findings: finding._id } },
                createOpts
            );
        }

        await auditCreate(user, entityType.FINDING, finding);

        if (finding.assignedTo) {
            await createNotification({
                userId: finding.assignedTo,
                title: "New finding assigned",
                message: `Finding "${finding.title}" has been assigned to you`,
                type: notificationType.FINDING,
                entityType: entityType.FINDING,
                entityId: finding._id
            });
        }

        return finding;
    };

    if (options.transactional) {
        return withTransaction(runCreate);
    }

    return runCreate();
};

export const listFindings = async (query) => {
    const { page, limit, skip, sort } = parsePagination(query);
    const filter = {};

    if (query.severity) filter.severity = query.severity;
    if (query.status) filter.status = query.status;
    if (query.asset) filter.asset = query.asset;
    if (query.sourceModule) filter.sourceModule = query.sourceModule;
    if (query.riskRating) filter.riskRating = query.riskRating;
    if (query.assignedTo) filter.assignedTo = query.assignedTo;

    const searchFilter = buildTextSearch(query.search, ["title", "description", "asset"]);
    const finalFilter = Object.keys(searchFilter).length ? { $and: [filter, searchFilter] } : filter;

    const [data, total] = await Promise.all([
        Finding.find(finalFilter)
            .sort(sort)
            .skip(skip)
            .limit(limit)
            .populate("createdBy", "name email")
            .populate("assignedTo", "name email"),
        Finding.countDocuments(finalFilter)
    ]);

    return { data, page, limit, total };
};

export const getFindingById = async (id) => {
    const finding = await Finding.findById(id)
        .populate("createdBy", "name email")
        .populate("assignedTo", "name email")
        .populate("closedBy", "name email");
    if (!finding) throw new AppError(messages.finding.notFound, 404);
    return finding;
};

export const updateFinding = async (id, updates, user) => {
    const finding = await Finding.findById(id);
    if (!finding) throw new AppError(messages.finding.notFound, 404);

    const oldValue = finding.toObject();
    Object.assign(finding, updates);
    await finding.save();

    await auditUpdate(user, entityType.FINDING, finding._id, oldValue, finding.toObject());
    return finding;
};

export const assignFinding = async (id, assignedTo, user) => {
    const finding = await Finding.findById(id);
    if (!finding) throw new AppError(messages.finding.notFound, 404);

    const oldValue = { assignedTo: finding.assignedTo };
    finding.assignedTo = assignedTo;
    if (finding.status === findingStatus.OPEN) finding.status = findingStatus.IN_PROGRESS;
    await finding.save();

    await recordAudit({
        user,
        action: auditAction.ASSIGN,
        entityType: entityType.FINDING,
        entityId: finding._id,
        oldValue,
        newValue: { assignedTo }
    });

    await createNotification({
        userId: assignedTo,
        title: "Finding assigned",
        message: `You have been assigned finding "${finding.title}"`,
        type: notificationType.FINDING,
        entityType: entityType.FINDING,
        entityId: finding._id
    });

    return finding;
};

export const closeFinding = async (id, user) => {
    const finding = await Finding.findById(id);
    if (!finding) throw new AppError(messages.finding.notFound, 404);

    const oldValue = { status: finding.status };
    finding.status = findingStatus.CLOSED;
    finding.closedBy = user._id;
    finding.closedAt = new Date();
    await finding.save();

    await recordAudit({
        user,
        action: auditAction.CLOSE,
        entityType: entityType.FINDING,
        entityId: finding._id,
        oldValue,
        newValue: { status: findingStatus.CLOSED }
    });

    return finding;
};

export const reopenFinding = async (id, user) => {
    const finding = await Finding.findById(id);
    if (!finding) throw new AppError(messages.finding.notFound, 404);

    const oldValue = { status: finding.status };
    finding.status = findingStatus.REOPENED;
    finding.closedAt = undefined;
    finding.closedBy = undefined;
    await finding.save();

    await recordAudit({
        user,
        action: auditAction.REOPEN,
        entityType: entityType.FINDING,
        entityId: finding._id,
        oldValue,
        newValue: { status: findingStatus.REOPENED }
    });

    return finding;
};

export const deleteFinding = async (id, user) => {
    const finding = await Finding.findById(id);
    if (!finding) throw new AppError(messages.finding.notFound, 404);

    await auditDelete(user, entityType.FINDING, finding);
    await Finding.findByIdAndDelete(id);
    return finding;
};

export const getFindingHistory = async (findingId) => {
    const { AuditLog } = await import("../../../../database/index.js");
    return AuditLog.find({ entityType: entityType.FINDING, entityId: findingId })
        .sort({ timestamp: -1 })
        .populate("user", "name email role");
};
