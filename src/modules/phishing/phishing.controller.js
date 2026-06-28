import { successResponse, paginatedResponse } from "../../utils/apiResponse.js";
import { messages } from "../../utils/constant/messages.js";
import * as templateService from "./services/template.service.js";
import * as landingPageService from "./services/landingPage.service.js";
import * as recipientService from "./services/recipient.service.js";
import * as campaignService from "./services/campaign.service.js";
import * as trackingService from "./services/tracking.service.js";
import * as reportService from "./services/report.service.js";
import * as dashboardService from "./services/dashboard.service.js";
import * as eventService from "./services/event.service.js";
import * as integrationService from "./services/integration.service.js";
import * as settingsService from "./services/settings.service.js";

// ─── Templates ───────────────────────────────────────────────────────────────
export const createTemplate = async (req, res) => {
    const data = await templateService.createTemplate(req.body, req.authUser);
    return successResponse(res, { message: messages.template.createdSuccessfully, data, statusCode: 201 });
};

export const getTemplates = async (req, res) => {
    const result = await templateService.listTemplates(req.query);
    return paginatedResponse(res, { message: "Templates fetched", ...result });
};

export const getTemplate = async (req, res) => {
    const data = await templateService.getTemplateById(req.params.id);
    return successResponse(res, { message: "Template fetched", data });
};

export const updateTemplate = async (req, res) => {
    const data = await templateService.updateTemplate(req.params.id, req.body);
    return successResponse(res, { message: messages.template.updatedSuccessfully, data });
};

export const deleteTemplate = async (req, res) => {
    await templateService.deleteTemplate(req.params.id);
    return successResponse(res, { message: messages.template.deletedSuccessfully, data: null });
};

// ─── Landing Pages ───────────────────────────────────────────────────────────
export const createLandingPage = async (req, res) => {
    const data = await landingPageService.createLandingPage(req.body, req.authUser);
    return successResponse(res, { message: messages.landingPage.createdSuccessfully, data, statusCode: 201 });
};

export const getLandingPages = async (req, res) => {
    const result = await landingPageService.listLandingPages(req.query);
    return paginatedResponse(res, { message: "Landing pages fetched", ...result });
};

export const getLandingPage = async (req, res) => {
    const data = await landingPageService.getLandingPageById(req.params.id);
    return successResponse(res, { message: "Landing page fetched", data });
};

export const updateLandingPage = async (req, res) => {
    const data = await landingPageService.updateLandingPage(req.params.id, req.body);
    return successResponse(res, { message: messages.landingPage.updatedSuccessfully, data });
};

export const deleteLandingPage = async (req, res) => {
    await landingPageService.deleteLandingPage(req.params.id);
    return successResponse(res, { message: messages.landingPage.deletedSuccessfully, data: null });
};

// ─── Recipients ──────────────────────────────────────────────────────────────
export const importRecipients = async (req, res) => {
    const result = await recipientService.importRecipients(req.body);
    return successResponse(res, { message: messages.recipient.importedSuccessfully, data: result, statusCode: 201 });
};

export const getRecipients = async (req, res) => {
    const result = await recipientService.listRecipients(req.query);
    return paginatedResponse(res, { message: "Recipients fetched", ...result });
};

export const getRecipient = async (req, res) => {
    const data = await recipientService.getRecipientById(req.params.id);
    return successResponse(res, { message: "Recipient fetched", data });
};

export const updateRecipient = async (req, res) => {
    const data = await recipientService.updateRecipient(req.params.id, req.body);
    return successResponse(res, { message: messages.recipient.updatedSuccessfully, data });
};

export const deleteRecipient = async (req, res) => {
    await recipientService.deleteRecipient(req.params.id);
    return successResponse(res, { message: messages.recipient.deletedSuccessfully, data: null });
};

// ─── Campaigns ───────────────────────────────────────────────────────────────
export const createCampaign = async (req, res) => {
    const data = await campaignService.createCampaign(req.body, req.authUser);
    return successResponse(res, { message: messages.campaign.createdSuccessfully, data, statusCode: 201 });
};

export const getCampaigns = async (req, res) => {
    const result = await campaignService.listCampaigns(req.query);
    return paginatedResponse(res, { message: "Campaigns fetched", ...result });
};

export const getCampaign = async (req, res) => {
    const data = await campaignService.getCampaignById(req.params.id);
    return successResponse(res, { message: "Campaign fetched", data });
};

export const updateCampaign = async (req, res) => {
    const data = await campaignService.updateCampaign(req.params.id, req.body);
    return successResponse(res, { message: messages.campaign.updatedSuccessfully, data });
};

export const deleteCampaign = async (req, res) => {
    await campaignService.deleteCampaign(req.params.id);
    return successResponse(res, { message: messages.campaign.deletedSuccessfully, data: null });
};

export const addCampaignRecipients = async (req, res) => {
    const data = await campaignService.addRecipientsToCampaign(req.params.id, req.body.recipients, req);
    return successResponse(res, { message: messages.recipient.importedSuccessfully, data, statusCode: 201 });
};

export const launchCampaign = async (req, res) => {
    const data = await campaignService.launchCampaign(req.params.id, req.body.trackingDomain, req);
    return successResponse(res, { message: messages.campaign.launchedSuccessfully, data });
};

export const pauseCampaign = async (req, res) => {
    const data = await campaignService.pauseCampaign(req.params.id);
    return successResponse(res, { message: messages.campaign.pausedSuccessfully, data });
};

export const resumeCampaign = async (req, res) => {
    const data = await campaignService.resumeCampaign(req.params.id, req);
    return successResponse(res, { message: messages.campaign.resumedSuccessfully, data });
};

export const stopCampaign = async (req, res) => {
    const data = await campaignService.stopCampaign(req.params.id);
    return successResponse(res, { message: messages.campaign.stoppedSuccessfully, data });
};

// ─── Tracking (public) ───────────────────────────────────────────────────────
export const trackOpen = async (req, res) => {
    const pixel = await trackingService.trackOpen(req.params.trackingId, req);
    res.set({
        "Content-Type": "image/gif",
        "Cache-Control": "no-store, no-cache, must-revalidate, private",
        Pragma: "no-cache",
        Expires: "0"
    });
    return res.send(pixel);
};

export const trackClick = async (req, res) => {
    const { redirect } = await trackingService.trackClick(req.params.trackingId, req);
    return res.redirect(redirect);
};

export const trackVisit = async (req, res) => {
    await trackingService.trackVisit(req.params.trackingId, req);
    return successResponse(res, { message: "Visit tracked", data: null });
};

export const trackSubmit = async (req, res) => {
    await trackingService.trackSubmit(req.params.trackingId, req);
    return successResponse(res, { message: "Submission tracked", data: null });
};

export const trackDownload = async (req, res) => {
    await trackingService.trackDownload(req.params.trackingId, req);
    return successResponse(res, { message: "Download tracked", data: null });
};

export const serveLanding = async (req, res) => {
    const { html, title } = await trackingService.serveLandingPage(req.params.trackingId, req);
    res.set("Content-Type", "text/html; charset=utf-8");
    if (title) res.set("X-Landing-Title", title);
    return res.send(html);
};

// ─── Reports ─────────────────────────────────────────────────────────────────
export const generateReport = async (req, res) => {
    const data = await reportService.queueReportGeneration(req.params.campaignId, req.authUser);
    return successResponse(res, { message: messages.phishingReport.generateQueued, data, statusCode: 202 });
};

export const downloadReport = async (req, res) => {
    const report = await reportService.getReportDownload(req.params.campaignId);
    return res.download(report.pdfPath);
};

export const getReportStats = async (req, res) => {
    const data = await reportService.getReportStats(req.params.campaignId);
    return successResponse(res, { message: "Campaign stats fetched", data });
};

// ─── Dashboard ───────────────────────────────────────────────────────────────
export const getDashboardOverview = async (req, res) => {
    const data = await dashboardService.getOverview();
    return successResponse(res, { message: "Dashboard overview fetched", data });
};

export const getDashboardRisks = async (req, res) => {
    const data = await dashboardService.getRiskDashboard();
    return successResponse(res, { message: "Risk dashboard fetched", data });
};

export const getDashboardDepartments = async (req, res) => {
    const data = await dashboardService.getDepartmentStats();
    return successResponse(res, { message: "Department stats fetched", data });
};

export const getDashboardTrends = async (req, res) => {
    const data = await dashboardService.getTrends(req.query.days);
    return successResponse(res, { message: "Trend data fetched", data });
};

export const getEvents = async (req, res) => {
    const result = await eventService.listEvents(req.query);
    return paginatedResponse(res, { message: "Tracking events fetched", ...result });
};

// ─── Integrations ──────────────────────────────────────────────────────────
export const integrateGrcRisk = async (req, res) => {
    const data = await integrationService.pushGrcRisk(req.body, req.authUser);
    return successResponse(res, { message: messages.integration.ingestedSuccessfully, data, statusCode: 201 });
};

export const integrateSoarIncident = async (req, res) => {
    const data = await integrationService.pushSoarIncident(req.body, req.authUser);
    return successResponse(res, { message: messages.integration.ingestedSuccessfully, data, statusCode: 201 });
};

export const integrateSiemEvent = async (req, res) => {
    const data = await integrationService.pushSiemEvent(req.body);
    return successResponse(res, { message: messages.integration.ingestedSuccessfully, data });
};

export const integrateOpenCtiIndicator = async (req, res) => {
    const data = await integrationService.pushOpenCtiIndicator(req.body);
    return successResponse(res, { message: messages.integration.ingestedSuccessfully, data, statusCode: 201 });
};

// ─── Settings ────────────────────────────────────────────────────────────────
export const getSettings = async (req, res) => {
    const data = await settingsService.getSettings(req);
    return successResponse(res, { message: "Phishing settings fetched", data });
};

export const updateSettings = async (req, res) => {
    const data = await settingsService.updateSettings(req.body, req);
    return successResponse(res, { message: messages.phishingSettings.updatedSuccessfully, data });
};
