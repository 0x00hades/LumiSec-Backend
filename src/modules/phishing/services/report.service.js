import fs from "fs";
import path from "path";
import { CampaignReport, Campaign } from "../../../../database/index.js";
import { AppError } from "../../../utils/appError.js";
import { messages } from "../../../utils/constant/messages.js";
import { reportQueue } from "../../../utils/queue.js";
import * as campaignService from "./campaign.service.js";

const reportDir = process.env.REPORT_DIR || "uploads/reports";

export const queueReportGeneration = async (campaignId, user) => {
    const campaign = await Campaign.findById(campaignId);
    if (!campaign) throw new AppError(messages.campaign.notFound, 404);

    const stats = await campaignService.getCampaignStats(campaignId);

    let report = await CampaignReport.findOne({ campaignId }).sort({ generatedAt: -1 });
    if (!report) {
        report = await CampaignReport.create({
            campaignId,
            generatedBy: user._id,
            stats
        });
    }

    await reportQueue.add("generatePhishingReport", {
        reportId: report._id,
        campaignId,
        userId: user._id
    });

    return { report, stats };
};

export const getReportDownload = async (campaignId) => {
    const report = await CampaignReport.findOne({ campaignId }).sort({ generatedAt: -1 });
    if (!report?.pdfPath) throw new AppError(messages.phishingReport.pdfNotReady, 404);

    if (!fs.existsSync(report.pdfPath)) {
        throw new AppError(messages.phishingReport.pdfNotReady, 404);
    }

    return report;
};

export const getReportStats = async (campaignId) => {
    const campaign = await Campaign.findById(campaignId);
    if (!campaign) throw new AppError(messages.campaign.notFound, 404);
    return campaignService.getCampaignStats(campaignId);
};

export const generatePhishingPdf = async (report, campaign, stats) => {
    const { default: PDFDocument } = await import("pdfkit");

    fs.mkdirSync(reportDir, { recursive: true });
    const filename = `phishing-report-${campaign._id}-${Date.now()}.pdf`;
    const filePath = path.join(reportDir, filename);

    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({ margin: 50 });
        const stream = fs.createWriteStream(filePath);
        doc.pipe(stream);

        doc.fontSize(20).text(`Phishing Campaign Report: ${campaign.name}`, { underline: true });
        doc.moveDown();
        doc.fontSize(12).text(`Status: ${campaign.status}`);
        doc.text(`Launch Date: ${campaign.launchDate ? new Date(campaign.launchDate).toISOString() : "N/A"}`);
        doc.text(`Recipients: ${campaign.recipientsCount}`);
        doc.moveDown();
        doc.fontSize(14).text("Engagement Statistics");
        doc.fontSize(11);
        doc.text(`Emails Sent: ${stats.emailsSent}`);
        doc.text(`Opened: ${stats.opened} (${stats.openRate}%)`);
        doc.text(`Clicked: ${stats.clicked} (${stats.clickRate}%)`);
        doc.text(`Submitted: ${stats.submitted} (${stats.submissionRate}%)`);
        doc.end();

        stream.on("finish", () => resolve(filePath));
        stream.on("error", reject);
    });
};
