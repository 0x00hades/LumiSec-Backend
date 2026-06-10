import { RemediationTask, Finding } from "../../../../database/index.js";
import { AppError } from "../../../utils/appError.js";
import { messages } from "../../../utils/constant/messages.js";
import { findingStatus, taskStatus, entityType, auditAction, notificationType } from "../../../utils/constant/enums.js";
import { parsePagination } from "../../../utils/pagination.js";
import { auditCreate, auditUpdate, recordAudit } from "../../../utils/auditLogger.js";
import { createNotification } from "../../../utils/notificationHelper.js";

export const createTask = async (data, user) => {
    const finding = await Finding.findById(data.findingId);
    if (!finding) throw new AppError(messages.finding.notFound, 404);

    const task = await RemediationTask.create({
        ...data,
        assignedBy: user._id
    });

    if (finding.status === findingStatus.OPEN || finding.status === findingStatus.REOPENED) {
        finding.status = findingStatus.IN_PROGRESS;
        await finding.save();
    }

    await auditCreate(user, entityType.TASK, task);

    await createNotification({
        userId: task.assignedTo,
        title: "Remediation task assigned",
        message: `Task "${task.title}" has been assigned to you`,
        type: notificationType.TASK,
        entityType: entityType.TASK,
        entityId: task._id
    });

    return task;
};

export const listTasks = async (query) => {
    const { page, limit, skip, sort } = parsePagination(query);
    const filter = {};
    if (query.status) filter.status = query.status;
    if (query.priority) filter.priority = query.priority;
    if (query.assignedTo) filter.assignedTo = query.assignedTo;
    if (query.findingId) filter.findingId = query.findingId;

    const [data, total] = await Promise.all([
        RemediationTask.find(filter)
            .sort(sort)
            .skip(skip)
            .limit(limit)
            .populate("assignedTo", "name email")
            .populate("findingId", "title status"),
        RemediationTask.countDocuments(filter)
    ]);

    return { data, page, limit, total };
};

export const getTaskById = async (id) => {
    const task = await RemediationTask.findById(id)
        .populate("assignedTo", "name email")
        .populate("assignedBy", "name email")
        .populate("findingId", "title status severity");
    if (!task) throw new AppError(messages.task.notFound, 404);
    return task;
};

export const updateTask = async (id, updates, user) => {
    const task = await RemediationTask.findById(id);
    if (!task) throw new AppError(messages.task.notFound, 404);

    const oldValue = task.toObject();
    Object.assign(task, updates);
    if (updates.status === taskStatus.IN_PROGRESS && task.status !== taskStatus.IN_PROGRESS) {
        task.status = taskStatus.IN_PROGRESS;
    }
    await task.save();

    await auditUpdate(user, entityType.TASK, task._id, oldValue, task.toObject());
    return task;
};

export const completeTask = async (id, user) => {
    const task = await RemediationTask.findById(id);
    if (!task) throw new AppError(messages.task.notFound, 404);

    const oldValue = { status: task.status };
    task.status = taskStatus.COMPLETED;
    task.completedAt = new Date();
    await task.save();

    const finding = await Finding.findById(task.findingId);
    if (finding) {
        finding.status = findingStatus.READY_FOR_RETEST;
        await finding.save();
    }

    await recordAudit({ user, action: auditAction.COMPLETE, entityType: entityType.TASK, entityId: task._id, oldValue, newValue: { status: taskStatus.COMPLETED } });
    return task;
};

export const verifyTask = async (id, user) => {
    const task = await RemediationTask.findById(id);
    if (!task) throw new AppError(messages.task.notFound, 404);
    if (task.status !== taskStatus.COMPLETED) throw new AppError(messages.task.cannotVerify, 400);

    const oldValue = { status: task.status };
    task.status = taskStatus.VERIFIED;
    task.verifiedBy = user._id;
    task.verifiedAt = new Date();
    await task.save();

    await recordAudit({ user, action: auditAction.VERIFY, entityType: entityType.TASK, entityId: task._id, oldValue, newValue: { status: taskStatus.VERIFIED } });
    return task;
};
