import { Incident, Playbook } from "../../../database/index.js";
import { AppError } from "../../utils/appError.js";
import { successResponse, paginatedResponse } from "../../utils/apiResponse.js";
import { messages } from "../../utils/constant/messages.js";
import { soarQueue } from "../../utils/queue.js";
import { emitAlert } from "../../utils/socket.js";
import { incidentStatus } from "../../utils/constant/enums.js";

export const createIncident = async (req, res, next) => {
    const { title, description, severity, sourceIP, affectedHost, playbookId } = req.body;
    const createdBy = req.authUser._id;

    const incident = await Incident.create({
        title, description, severity, sourceIP, affectedHost, createdBy
    });

    // Auto-execute playbook if provided
    if (playbookId) {
        const playbook = await Playbook.findById(playbookId);
        if (!playbook) return next(new AppError(messages.playbook.notFound, 404));

        incident.playbookExecuted = playbookId;
        await incident.save();

        // Queue async execution
        await soarQueue.add("executePlaybook", {
            incidentId: incident._id,
            playbookId,
            context: { sourceIP, affectedHost, severity }
        });
    }

    // Real-time alert
    emitAlert("soc_analyst", "incident:created", {
        incidentId: incident._id,
        title,
        severity
    });

    return successResponse(res, {
        message: messages.incident.createdSuccessfully,
        data: incident,
        statusCode: 201
    });
};

export const executePlaybook = async (req, res, next) => {
    const { incidentId, playbookId } = req.params;

    const [incident, playbook] = await Promise.all([
        Incident.findById(incidentId),
        Playbook.findById(playbookId)
    ]);

    if (!incident) return next(new AppError(messages.incident.notFound, 404));
    if (!playbook) return next(new AppError(messages.playbook.notFound, 404));

    await soarQueue.add("executePlaybook", {
        incidentId,
        playbookId,
        context: { sourceIP: incident.sourceIP, affectedHost: incident.affectedHost, severity: incident.severity }
    });

    return successResponse(res, { message: messages.playbook.executedSuccessfully, data: { queued: true } });
};

export const closeIncident = async (req, res, next) => {
    const { incidentId } = req.params;
    const { notes, isFalsePositive } = req.body;

    const incident = await Incident.findById(incidentId);
    if (!incident) return next(new AppError(messages.incident.notFound, 404));
    if (incident.status === incidentStatus.CLOSED) {
        return next(new AppError(messages.incident.alreadyClosed, 400));
    }

    incident.status = isFalsePositive ? incidentStatus.FALSE_POSITIVE : incidentStatus.CLOSED;
    incident.notes = notes;
    incident.closedAt = new Date();
    await incident.save();

    emitAlert("soc_manager", "incident:closed", { incidentId, status: incident.status });

    return successResponse(res, { message: messages.incident.closedSuccessfully, data: incident });
};

export const getIncidents = async (req, res, next) => {
    const { page = 1, limit = 20, severity, status } = req.query;
    const skip = (page - 1) * limit;
    const filter = {};
    if (severity) filter.severity = severity;
    if (status) filter.status = status;

    const [incidents, total] = await Promise.all([
        Incident.find(filter).sort({ createdAt: -1 }).skip(skip).limit(Number(limit))
            .populate("assignedTo", "name").populate("createdBy", "name"),
        Incident.countDocuments(filter)
    ]);

    return paginatedResponse(res, { message: "Incidents fetched", data: incidents, page: Number(page), limit: Number(limit), total });
};
