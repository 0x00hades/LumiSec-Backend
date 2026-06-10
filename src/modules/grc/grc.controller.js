import { Finding, RemediationTask, AuditReport } from "../../../database/index.js";
import { AppError } from "../../utils/appError.js";
import { successResponse, paginatedResponse } from "../../utils/apiResponse.js";
import { messages } from "../../utils/constant/messages.js";
import { findingStatus, roles } from "../../utils/constant/enums.js";

export const createFinding = async (req, res, next) => {
    const { title, description, riskRating, severity, control, auditReportId } = req.body;
    const createdBy = req.authUser._id;

    const finding = await Finding.create({ title, description, riskRating, severity, control, createdBy, auditReport: auditReportId });

    if (auditReportId) {
        await AuditReport.findByIdAndUpdate(auditReportId, { $push: { findings: finding._id } });
    }

    return successResponse(res, { message: messages.finding.createdSuccessfully, data: finding, statusCode: 201 });
};

export const createRemediationTask = async (req, res, next) => {
    const { findingId, assigneeId, description, dueDate } = req.body;
    const assignedBy = req.authUser._id;

    const finding = await Finding.findById(findingId);
    if (!finding) return next(new AppError(messages.finding.notFound, 404));

    const task = await RemediationTask.create({ finding: findingId, assignedTo: assigneeId, assignedBy, description, dueDate });

    finding.status = findingStatus.IN_PROGRESS;
    await finding.save();

    return successResponse(res, { message: "Remediation task created", data: task, statusCode: 201 });
};

export const closeFinding = async (req, res, next) => {
    const { findingId } = req.params;
    const { retestResult } = req.body;

    // Only auditor can close
    if (req.authUser.role !== roles.AUDITOR && req.authUser.role !== roles.ADMIN) {
        return next(new AppError(messages.auth.notAuthorized, 403));
    }

    const finding = await Finding.findById(findingId);
    if (!finding) return next(new AppError(messages.finding.notFound, 404));
    if (finding.status !== findingStatus.PENDING_RETEST) {
        return next(new AppError(messages.finding.cannotClose, 400));
    }

    if (retestResult === "ineffective") {
        finding.status = findingStatus.REOPENED;
        await finding.save();
        return successResponse(res, { message: messages.finding.reopenedSuccessfully, data: finding });
    }

    finding.status = findingStatus.CLOSED;
    finding.retestResult = "effective";
    finding.closedBy = req.authUser._id;
    finding.closedAt = new Date();
    await finding.save();

    return successResponse(res, { message: messages.finding.closedSuccessfully, data: finding });
};

export const getFindings = async (req, res, next) => {
    const { page = 1, limit = 20, status, riskRating } = req.query;
    const skip = (page - 1) * limit;
    const filter = {};
    if (status) filter.status = status;
    if (riskRating) filter.riskRating = riskRating;

    const [findings, total] = await Promise.all([
        Finding.find(filter).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)).populate("createdBy", "name"),
        Finding.countDocuments(filter)
    ]);

    return paginatedResponse(res, { message: "Findings fetched", data: findings, page: Number(page), limit: Number(limit), total });
};
