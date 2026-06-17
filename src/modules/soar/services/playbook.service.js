import {
  Playbook,
  PlaybookRun,
  PlaybookRunStep,
  Incident,
} from "../../../../database/index.js";
import { AppError } from "../../../utils/appError.js";
import { messages } from "../../../utils/constant/messages.js";
import {
  entityType,
  auditAction,
  playbookRunStatus,
  notificationType,
} from "../../../utils/constant/enums.js";
import { parsePagination, buildTextSearch } from "../../../utils/pagination.js";
import {
  auditCreate,
  auditUpdate,
  recordAudit,
} from "../../../utils/auditLogger.js";
import { createNotification } from "../../../utils/notificationHelper.js";
import { emitAlert } from "../../../utils/socket.js";
import * as playbookEngine from "../engine/playbookEngine.js";

export const createPlaybook = async (data, user) => {
  const existing = await Playbook.findOne({ name: data.name });
  if (existing) throw new AppError("Playbook name already exists", 409);

  const actions = (data.actions || []).map((action, index) => ({
    ...action,
    id: action.id || `step-${index}`,
    order: action.order ?? index,
  }));

  const playbook = await Playbook.create({
    ...data,
    actions,
    createdBy: user._id,
  });

  await auditCreate(user, entityType.PLAYBOOK, playbook);
  return playbook;
};

export const listPlaybooks = async (query) => {
  const { page, limit, skip, sort } = parsePagination(query);
  const filter = {};

  if (query.isActive !== undefined) filter.isActive = query.isActive === "true";
  if (query.triggerType) filter.triggerType = query.triggerType;

  const searchFilter = buildTextSearch(query.search, ["name", "description"]);
  const finalFilter = Object.keys(searchFilter).length
    ? { $and: [filter, searchFilter] }
    : filter;

  const [data, total] = await Promise.all([
    Playbook.find(finalFilter)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .populate("createdBy", "name email"),
    Playbook.countDocuments(finalFilter),
  ]);

  return { data, page, limit, total };
};

export const getPlaybookById = async (id) => {
  const playbook = await Playbook.findById(id).populate(
    "createdBy",
    "name email",
  );
  if (!playbook) throw new AppError(messages.playbook.notFound, 404);
  return playbook;
};

export const updatePlaybook = async (id, updates, user) => {
  const playbook = await Playbook.findById(id);
  if (!playbook) throw new AppError(messages.playbook.notFound, 404);

  const oldValue = playbook.toObject();

  if (updates.name && updates.name !== playbook.name) {
    const duplicate = await Playbook.findOne({
      name: updates.name,
      _id: { $ne: id },
    });
    if (duplicate) throw new AppError("Playbook name already exists", 409);
  }

  if (updates.actions) {
    updates.actions = updates.actions.map((action, index) => ({
      ...action,
      id: action.id || `step-${index}`,
      order: action.order ?? index,
    }));
    updates.version = (playbook.version || 1) + 1;
  }

  Object.assign(playbook, updates);
  await playbook.save();

  await auditUpdate(
    user,
    entityType.PLAYBOOK,
    playbook._id,
    oldValue,
    playbook.toObject(),
  );
  return playbook;
};

export const softDeletePlaybook = async (id, user) => {
  const playbook = await Playbook.findById(id);
  if (!playbook) throw new AppError(messages.playbook.notFound, 404);

  playbook.deletedAt = new Date();
  playbook.isActive = false;
  await playbook.save();

  await recordAudit({
    user,
    action: auditAction.DELETE,
    entityType: entityType.PLAYBOOK,
    entityId: playbook._id,
    oldValue: playbook.toObject(),
    newValue: { deletedAt: playbook.deletedAt },
  });

  return playbook;
};

export const executePlaybook = async (
  { incidentId, playbookId, context = {} },
  user,
) => {
  const [incident, playbook] = await Promise.all([
    Incident.findById(incidentId),
    Playbook.findById(playbookId),
  ]);

  if (!incident) throw new AppError(messages.incident.notFound, 404);
  if (!playbook) throw new AppError(messages.playbook.notFound, 404);
  if (!playbook.isActive) throw new AppError("Playbook is inactive", 400);

  const runContext = {
    sourceIP: context.sourceIP || incident.sourceIP,
    affectedHost: context.affectedHost || incident.affectedHost,
    severity: context.severity || incident.severity,
    incidentId,
    ...context,
  };

  const run = await playbookEngine.createRun({
    playbook,
    incidentId,
    userId: user._id,
    context: runContext,
  });

  await playbookEngine.queueRun(run, playbook, runContext);

  await recordAudit({
    user,
    action: auditAction.EXECUTE,
    entityType: entityType.PLAYBOOK,
    entityId: playbook._id,
    newValue: { runId: run._id, incidentId },
  });

  emitAlert("soc_analyst", "playbook:started", {
    runId: run._id,
    incidentId,
    playbookId: playbook._id,
    playbookName: playbook.name,
  });

  return { run, queued: true };
};

export const getRunStatus = async (runId) => {
  const run = await PlaybookRun.findById(runId)
    .populate("playbookId", "name version")
    .populate("incidentId", "title severity status")
    .populate("startedBy", "name email");

  if (!run) throw new AppError("Playbook run not found", 404);

  const steps = await PlaybookRunStep.find({ runId }).sort({ stepIndex: 1 });
  return { run, steps };
};

export const listPlaybookRuns = async (query) => {
  const { page, limit, skip, sort } = parsePagination(query);
  const filter = {};

  if (query.incidentId) filter.incidentId = query.incidentId;
  if (query.playbookId) filter.playbookId = query.playbookId;
  if (query.status) filter.status = query.status;

  const [data, total] = await Promise.all([
    PlaybookRun.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .populate("playbookId", "name")
      .populate("incidentId", "title severity")
      .populate("startedBy", "name email"),
    PlaybookRun.countDocuments(filter),
  ]);

  return { data, page, limit, total };
};

export const pauseRun = async (runId, user) => {
  const run = await PlaybookRun.findById(runId);
  if (!run) throw new AppError("Playbook run not found", 404);

  const paused = await playbookEngine.pauseRun(runId);

  await recordAudit({
    user,
    action: auditAction.UPDATE,
    entityType: entityType.PLAYBOOK_RUN,
    entityId: run._id,
    oldValue: { status: run.status },
    newValue: { status: playbookRunStatus.PAUSED },
  });

  return paused;
};

export const resumeRun = async (runId, user) => {
  const run = await PlaybookRun.findById(runId);
  if (!run) throw new AppError("Playbook run not found", 404);

  const resumed = await playbookEngine.resumeRun(runId);

  await recordAudit({
    user,
    action: auditAction.UPDATE,
    entityType: entityType.PLAYBOOK_RUN,
    entityId: run._id,
    oldValue: { status: playbookRunStatus.PAUSED },
    newValue: { status: playbookRunStatus.RUNNING },
  });

  return resumed;
};

export const cancelRun = async (runId, user) => {
  const run = await PlaybookRun.findById(runId);
  if (!run) throw new AppError("Playbook run not found", 404);

  const cancelled = await playbookEngine.cancelRun(runId);

  await recordAudit({
    user,
    action: auditAction.UPDATE,
    entityType: entityType.PLAYBOOK_RUN,
    entityId: run._id,
    oldValue: { status: run.status },
    newValue: { status: playbookRunStatus.CANCELLED },
  });

  emitAlert("soc_analyst", "playbook:cancelled", {
    runId,
    incidentId: run.incidentId,
  });

  return cancelled;
};

export const notifyPlaybookCompleted = async (runId, userId) => {
  const run = await PlaybookRun.findById(runId).populate("playbookId", "name");
  if (!run || !userId) return;

  await createNotification({
    userId,
    title: "Playbook completed",
    message: `Playbook "${run.playbookId?.name}" finished with status ${run.status}`,
    type: notificationType.PLAYBOOK,
    entityType: entityType.PLAYBOOK_RUN,
    entityId: run._id,
  });
};
