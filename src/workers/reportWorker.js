import fs from "fs";
import path from "path";
import PDFDocument from "pdfkit";
import { reportQueue } from "../utils/queue.js";
import { AuditReport } from "../../database/index.js";
import { logger } from "../utils/logger.js";
import { recordAudit } from "../utils/auditLogger.js";
import { entityType, auditAction } from "../utils/constant/enums.js";

const reportDir = process.env.REPORT_DIR || "uploads/reports";
fs.mkdirSync(reportDir, { recursive: true });

const generatePdf = (report, findings) => new Promise((resolve, reject) => {
    const filename = `report-${report._id}-${Date.now()}.pdf`;
    const filePath = path.join(reportDir, filename);
    const doc = new PDFDocument({ margin: 50 });
    const stream = fs.createWriteStream(filePath);

    doc.pipe(stream);
    doc.fontSize(20).text(report.title, { underline: true });
    doc.moveDown();
    doc.fontSize(12).text(`Framework: ${report.framework}`);
    doc.text(`Generated: ${new Date(report.generatedAt).toISOString()}`);
    if (report.scope) doc.text(`Scope: ${report.scope}`);
    doc.moveDown();
    doc.fontSize(14).text("Summary");
    doc.fontSize(11).text(report.summary || "No summary provided.");
    doc.moveDown();
    doc.fontSize(14).text(`Findings (${findings.length})`);
    doc.moveDown(0.5);

    findings.forEach((f, i) => {
        doc.fontSize(11).text(`${i + 1}. ${f.title}`);
        doc.fontSize(10).text(`   Severity: ${f.severity} | Risk: ${f.riskRating} | Status: ${f.status}`);
        doc.text(`   ${f.description.substring(0, 200)}${f.description.length > 200 ? "..." : ""}`);
        doc.moveDown(0.3);
    });

    doc.end();
    stream.on("finish", () => resolve(filePath));
    stream.on("error", reject);
});

reportQueue.process("generateAuditReport", async (job) => {
    const { reportId, userId } = job.data;

    const report = await AuditReport.findById(reportId).populate("findings", "title description severity riskRating status");
    if (!report) throw new Error("Audit report not found");

    try {
        const pdfPath = await generatePdf(report, report.findings);
        report.pdfPath = pdfPath;
        report.status = "ready";
        await report.save();

        await recordAudit({
            user: userId,
            action: auditAction.GENERATE,
            entityType: entityType.REPORT,
            entityId: report._id,
            newValue: { status: "ready", pdfPath }
        });

        logger.info(`Audit report PDF generated: ${reportId}`);
        return { reportId, pdfPath };
    } catch (err) {
        report.status = "draft";
        await report.save();
        logger.error(`Report generation failed for ${reportId}: ${err.message}`);
        throw err;
    }
});

logger.info("Report worker started");
