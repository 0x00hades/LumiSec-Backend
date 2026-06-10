import fs from "fs";
import path from "path";
import { AuditReport, Finding } from "../../../../database/index.js";
import { AppError } from "../../../utils/appError.js";
import { messages } from "../../../utils/constant/messages.js";
import { entityType, auditAction } from "../../../utils/constant/enums.js";
import { parsePagination } from "../../../utils/pagination.js";
import { auditCreate, auditUpdate, auditDelete, recordAudit } from "../../../utils/auditLogger.js";
import { reportQueue } from "../../../utils/queue.js";

const reportDir = process.env.REPORT_DIR || "uploads/reports";
fs.mkdirSync(reportDir, { recursive: true });

export const createReport = async (data, user) => {
    const report = await AuditReport.create({
        ...data,
        generatedBy: user._id,
        generatedAt: new Date()
    });
    await auditCreate(user, entityType.REPORT, report);
    return report;
};

export const listReports = async (query) => {
    const { page, limit, skip, sort } = parsePagination(query);
    const filter = {};
    if (query.framework) filter.framework = query.framework;
    if (query.status) filter.status = query.status;

    const [data, total] = await Promise.all([
        AuditReport.find(filter).sort(sort).skip(skip).limit(limit).populate("generatedBy", "name email"),
        AuditReport.countDocuments(filter)
    ]);

    return { data, page, limit, total };
};

export const getReportById = async (id) => {
    const report = await AuditReport.findById(id)
        .populate("generatedBy", "name email")
        .populate("findings", "title severity riskRating status");
    if (!report) throw new AppError(messages.report.notFound, 404);
    return report;
};

export const updateReport = async (id, updates, user) => {
    const report = await AuditReport.findById(id);
    if (!report) throw new AppError(messages.report.notFound, 404);

    const oldValue = report.toObject();
    Object.assign(report, updates);
    await report.save();

    await auditUpdate(user, entityType.REPORT, report._id, oldValue, report.toObject());
    return report;
};

export const deleteReport = async (id, user) => {
    const report = await AuditReport.findById(id);
    if (!report) throw new AppError(messages.report.notFound, 404);

    if (report.pdfPath && fs.existsSync(report.pdfPath)) fs.unlinkSync(report.pdfPath);

    await auditDelete(user, entityType.REPORT, report);
    await AuditReport.findByIdAndDelete(id);
    return report;
};

export const addFindingsToReport = async (id, findingIds, user) => {
    const report = await AuditReport.findById(id);
    if (!report) throw new AppError(messages.report.notFound, 404);

    const findings = await Finding.find({ _id: { $in: findingIds } });
    if (findings.length !== findingIds.length) throw new AppError(messages.finding.notFound, 404);

    const oldValue = { findings: report.findings };
    report.findings = [...new Set([...report.findings.map(String), ...findingIds.map(String)])];
    await report.save();

    await recordAudit({
        user,
        action: auditAction.LINK,
        entityType: entityType.REPORT,
        entityId: report._id,
        oldValue,
        newValue: { findings: report.findings }
    });

    return report;
};

export const generateReportPdf = async (id, user) => {
    const report = await AuditReport.findById(id);
    if (!report) throw new AppError(messages.report.notFound, 404);

    report.status = "generating";
    await report.save();

    await reportQueue.add("generateAuditReport", { reportId: report._id.toString(), userId: user._id.toString() });

    await recordAudit({
        user,
        action: auditAction.GENERATE,
        entityType: entityType.REPORT,
        entityId: report._id,
        newValue: { status: "generating" }
    });

    return report;
};

export const getReportDownloadPath = async (id) => {
    const report = await AuditReport.findById(id);
    if (!report) throw new AppError(messages.report.notFound, 404);
    if (!report.pdfPath || !fs.existsSync(report.pdfPath)) throw new AppError(messages.report.pdfNotReady, 404);

    return {
        path: report.pdfPath,
        filename: `${report.title.replace(/\s+/g, "_")}.pdf`
    };
};
