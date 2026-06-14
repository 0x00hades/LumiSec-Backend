import {
    Incident, IncidentNote, Artifact, PlaybookRun, SoarAlert, AuditLog
} from "../../../../database/index.js";
import { AppError } from "../../../utils/appError.js";
import { messages } from "../../../utils/constant/messages.js";
import {
    incidentStatus, entityType, auditAction, notificationType
} from "../../../utils/constant/enums.js";
import { parsePagination, buildTextSearch } from "../../../utils/pagination.js";
import { auditCreate, auditUpdate, recordAudit } from "../../../utils/auditLogger.js";
import { createNotification } from "../../../utils/notificationHelper.js";
import { emitAlert } from "../../../utils/socket.js";

const CLOSED_STATUSES = [incidentStatus.CLOSED, incidentStatus.FALSE_POSITIVE, incidentStatus.RESOLVED];

export const createIncident = async (data, user) => {
    const incident = await Incident.create({
        ...data,
        createdBy: user._id,
        status: data.status || incidentStatus.NEW
    });

    await auditCreate(user, entityType.INCIDENT, incident);

    emitAlert("soc_analyst", "incident:created", {
        incidentId: incident._id,
        title: incident.title,
        severity: incident.severity
    });

    if (incident.assignedTo) {
        await createNotification({
            userId: incident.assignedTo,
            title: "Incident assigned",
            message: `Incident "${incident.title}" has been assigned to you`,
            type: notificationType.INCIDENT,
            entityType: entityType.INCIDENT,
            entityId: incident._id
        });
    }

    return incident;
};

export const listIncidents = async (query) => {
    const { page, limit, skip, sort } = parsePagination(query);
    const filter = {};

    if (query.severity) filter.severity = query.severity;
    if (query.status) filter.status = query.status;
    if (query.incidentType) filter.incidentType = query.incidentType;
    if (query.assignedTo) filter.assignedTo = query.assignedTo;
    if (query.createdBy) filter.createdBy = query.createdBy;

    const searchFilter = buildTextSearch(query.search, ["title", "description", "sourceIP", "affectedHost"]);
    const finalFilter = Object.keys(searchFilter).length ? { $and: [filter, searchFilter] } : filter;

    const [data, total] = await Promise.all([
        Incident.find(finalFilter)
            .sort(sort)
            .skip(skip)
            .limit(limit)
            .populate("assignedTo", "name email")
            .populate("createdBy", "name email"),
        Incident.countDocuments(finalFilter)
    ]);

    return { data, page, limit, total };
};

export const getIncidentById = async (id) => {
    const incident = await Incident.findById(id)
        .populate("assignedTo", "name email role")
        .populate("createdBy", "name email")
        .populate("relatedIncidents", "title severity status createdAt");

    if (!incident) throw new AppError(messages.incident.notFound, 404);
    return incident;
};

export const updateIncident = async (id, updates, user) => {
    const incident = await Incident.findById(id);
    if (!incident) throw new AppError(messages.incident.notFound, 404);

    const reopening = [incidentStatus.OPEN, incidentStatus.IN_PROGRESS, incidentStatus.NEW].includes(updates.status);
    if (CLOSED_STATUSES.includes(incident.status) && !reopening) {
        throw new AppError("Cannot update a closed or resolved incident", 400);
    }

    const oldValue = incident.toObject();
    Object.assign(incident, updates);

    if (updates.status === incidentStatus.OPEN && !incident.assignedTo && updates.assignedTo) {
        incident.assignedTo = updates.assignedTo;
    }

    await incident.save();
    await auditUpdate(user, entityType.INCIDENT, incident._id, oldValue, incident.toObject());

    if (updates.assignedTo && String(updates.assignedTo) !== String(oldValue.assignedTo)) {
        await createNotification({
            userId: updates.assignedTo,
            title: "Incident assigned",
            message: `Incident "${incident.title}" has been assigned to you`,
            type: notificationType.INCIDENT,
            entityType: entityType.INCIDENT,
            entityId: incident._id
        });
    }

    return incident;
};

export const softDeleteIncident = async (id, user) => {
    const incident = await Incident.findById(id);
    if (!incident) throw new AppError(messages.incident.notFound, 404);

    const oldValue = { deletedAt: incident.deletedAt };
    incident.deletedAt = new Date();
    await incident.save();

    await recordAudit({
        user,
        action: auditAction.DELETE,
        entityType: entityType.INCIDENT,
        entityId: incident._id,
        oldValue,
        newValue: { deletedAt: incident.deletedAt }
    });

    return incident;
};

export const closeIncident = async (id, { notes, isFalsePositive, resolution } = {}, user) => {
    const incident = await Incident.findById(id);
    if (!incident) throw new AppError(messages.incident.notFound, 404);

    if (CLOSED_STATUSES.includes(incident.status)) {
        throw new AppError(messages.incident.alreadyClosed, 400);
    }

    const oldValue = { status: incident.status };
    incident.status = isFalsePositive ? incidentStatus.FALSE_POSITIVE : incidentStatus.CLOSED;
    incident.closedAt = new Date();
    if (resolution) incident.resolvedAt = new Date();

    await incident.save();

    if (notes) {
        await IncidentNote.create({
            incidentId: incident._id,
            content: notes,
            createdBy: user._id,
            isInternal: true
        });
    }

    await recordAudit({
        user,
        action: auditAction.CLOSE,
        entityType: entityType.INCIDENT,
        entityId: incident._id,
        oldValue,
        newValue: { status: incident.status, closedAt: incident.closedAt }
    });

    emitAlert("soc_manager", "incident:closed", {
        incidentId: incident._id,
        status: incident.status
    });

    return incident;
};

export const getIncidentTimeline = async (incidentId) => {
    const incident = await Incident.findById(incidentId);
    if (!incident) throw new AppError(messages.incident.notFound, 404);

    const [auditEntries, notes, runs, alerts, artifacts] = await Promise.all([
        AuditLog.find({ entityType: entityType.INCIDENT, entityId: incidentId })
            .sort({ timestamp: -1 })
            .populate("user", "name email role"),
        IncidentNote.find({ incidentId }).sort({ createdAt: -1 }).populate("createdBy", "name email"),
        PlaybookRun.find({ incidentId }).sort({ createdAt: -1 })
            .populate("playbookId", "name")
            .populate("startedBy", "name email"),
        SoarAlert.find({ incidentId }).sort({ receivedAt: -1 }),
        Artifact.find({ incidentId }).sort({ createdAt: -1 })
    ]);

    const events = [
        ...auditEntries.map((e) => ({
            type: "audit",
            timestamp: e.timestamp,
            action: e.action,
            user: e.user,
            details: e.newValue
        })),
        ...notes.map((n) => ({
            type: "note",
            timestamp: n.createdAt,
            user: n.createdBy,
            content: n.content,
            isInternal: n.isInternal
        })),
        ...runs.map((r) => ({
            type: "playbook_run",
            timestamp: r.createdAt,
            status: r.status,
            playbook: r.playbookId,
            startedBy: r.startedBy,
            completedAt: r.completedAt
        })),
        ...alerts.map((a) => ({
            type: "alert",
            timestamp: a.receivedAt,
            source: a.source,
            title: a.title,
            severity: a.severity
        })),
        ...artifacts.map((a) => ({
            type: "artifact",
            timestamp: a.createdAt,
            artifactType: a.type,
            value: a.value
        })),
        {
            type: "incident_created",
            timestamp: incident.createdAt,
            user: incident.createdBy
        }
    ].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    return { incidentId, events };
};

export const getRelatedIncidents = async (incidentId) => {
    const incident = await Incident.findById(incidentId);
    if (!incident) throw new AppError(messages.incident.notFound, 404);

    const explicitRelated = incident.relatedIncidents?.length
        ? await Incident.find({ _id: { $in: incident.relatedIncidents } })
            .select("title severity status incidentType sourceIP affectedHost createdAt")
        : [];

    const matchConditions = [];
    if (incident.sourceIP) matchConditions.push({ sourceIP: incident.sourceIP });
    if (incident.affectedHost) matchConditions.push({ affectedHost: incident.affectedHost });
    if (incident.incidentType) matchConditions.push({ incidentType: incident.incidentType });

    let inferredRelated = [];
    if (matchConditions.length) {
        inferredRelated = await Incident.find({
            _id: { $ne: incidentId },
            $or: matchConditions,
            status: { $nin: CLOSED_STATUSES }
        })
            .sort({ createdAt: -1 })
            .limit(20)
            .select("title severity status incidentType sourceIP affectedHost createdAt");
    }

    return {
        explicit: explicitRelated,
        inferred: inferredRelated.filter(
            (r) => !explicitRelated.some((e) => String(e._id) === String(r._id))
        )
    };
};

export const linkRelatedIncident = async (incidentId, relatedIncidentId, user) => {
    const [incident, related] = await Promise.all([
        Incident.findById(incidentId),
        Incident.findById(relatedIncidentId)
    ]);

    if (!incident || !related) throw new AppError(messages.incident.notFound, 404);
    if (String(incidentId) === String(relatedIncidentId)) {
        throw new AppError("Cannot link an incident to itself", 400);
    }

    const oldValue = { relatedIncidents: [...(incident.relatedIncidents || [])] };
    if (!incident.relatedIncidents.some((id) => String(id) === String(relatedIncidentId))) {
        incident.relatedIncidents.push(relatedIncidentId);
        await incident.save();
    }

    await recordAudit({
        user,
        action: auditAction.LINK,
        entityType: entityType.INCIDENT,
        entityId: incident._id,
        oldValue,
        newValue: { relatedIncidents: incident.relatedIncidents }
    });

    return incident;
};

export const addIncidentNote = async (incidentId, content, user, isInternal = true) => {
    const incident = await Incident.findById(incidentId);
    if (!incident) throw new AppError(messages.incident.notFound, 404);

    return IncidentNote.create({
        incidentId,
        content,
        createdBy: user._id,
        isInternal
    });
};

export const listIncidentNotes = async (incidentId) => {
    const incident = await Incident.findById(incidentId);
    if (!incident) throw new AppError(messages.incident.notFound, 404);

    return IncidentNote.find({ incidentId })
        .sort({ createdAt: -1 })
        .populate("createdBy", "name email");
};
