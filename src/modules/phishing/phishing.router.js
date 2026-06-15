import { Router } from "express";
import { isValid } from "../../middleware/validation.js";
import { asyncHandler } from "../../middleware/asyncHandler.js";
import { isAuthenticated } from "../../middleware/authentication.js";
import { isServiceOrUserAuthenticated } from "../../middleware/serviceAuth.js";
import { rateLimit } from "../../middleware/rateLimit.js";
import { isAuthorized } from "../../middleware/authorization.js";
import { phishingPermissions as p } from "./permissions.js";
import {
    createTemplateValidation, updateTemplateValidation, templateIdValidation,
    createLandingPageValidation, updateLandingPageValidation, landingPageIdValidation,
    importRecipientsValidation, recipientIdValidation, updateRecipientValidation, listRecipientsValidation,
    createCampaignValidation, updateCampaignValidation, campaignIdValidation, campaignIdParamValidation,
    addCampaignRecipientsValidation, launchCampaignValidation,
    trackingIdParamValidation, trackSubmitValidation, trackDownloadValidation,
    grcRiskIntegrationValidation, soarIncidentIntegrationValidation,
    siemEventIntegrationValidation, openctiIndicatorValidation,
    listQueryValidation, dashboardTrendsValidation
} from "./phishing.validation.js";
import {
    createTemplate, getTemplates, getTemplate, updateTemplate, deleteTemplate,
    createLandingPage, getLandingPages, getLandingPage, updateLandingPage, deleteLandingPage,
    importRecipients, getRecipients, getRecipient, updateRecipient, deleteRecipient,
    createCampaign, getCampaigns, getCampaign, updateCampaign, deleteCampaign,
    addCampaignRecipients, launchCampaign, pauseCampaign, resumeCampaign, stopCampaign,
    trackOpen, trackClick, trackVisit, trackSubmit, trackDownload,
    generateReport, downloadReport, getReportStats,
    getDashboardOverview, getDashboardRisks, getDashboardDepartments, getDashboardTrends,
    integrateGrcRisk, integrateSoarIncident, integrateSiemEvent, integrateOpenCtiIndicator
} from "./phishing.controller.js";

const phishingRouter = Router();

// ─── Templates ───────────────────────────────────────────────────────────────
phishingRouter.post("/templates",
    isAuthenticated(), isAuthorized(p.templates.create), isValid(createTemplateValidation),
    asyncHandler(createTemplate)
);
phishingRouter.get("/templates",
    isAuthenticated(), isAuthorized(p.templates.read), isValid(listQueryValidation),
    asyncHandler(getTemplates)
);
phishingRouter.get("/templates/:id",
    isAuthenticated(), isAuthorized(p.templates.read), isValid(templateIdValidation),
    asyncHandler(getTemplate)
);
phishingRouter.patch("/templates/:id",
    isAuthenticated(), isAuthorized(p.templates.update), isValid(templateIdValidation), isValid(updateTemplateValidation),
    asyncHandler(updateTemplate)
);
phishingRouter.delete("/templates/:id",
    isAuthenticated(), isAuthorized(p.templates.delete), isValid(templateIdValidation),
    asyncHandler(deleteTemplate)
);

// ─── Landing Pages ───────────────────────────────────────────────────────────
phishingRouter.post("/landing-pages",
    isAuthenticated(), isAuthorized(p.landingPages.create), isValid(createLandingPageValidation),
    asyncHandler(createLandingPage)
);
phishingRouter.get("/landing-pages",
    isAuthenticated(), isAuthorized(p.landingPages.read), isValid(listQueryValidation, "query"),
    asyncHandler(getLandingPages)
);
phishingRouter.get("/landing-pages/:id",
    isAuthenticated(), isAuthorized(p.landingPages.read), isValid(landingPageIdValidation),
    asyncHandler(getLandingPage)
);
phishingRouter.patch("/landing-pages/:id",
    isAuthenticated(), isAuthorized(p.landingPages.update), isValid(landingPageIdValidation), isValid(updateLandingPageValidation),
    asyncHandler(updateLandingPage)
);
phishingRouter.delete("/landing-pages/:id",
    isAuthenticated(), isAuthorized(p.landingPages.delete), isValid(landingPageIdValidation),
    asyncHandler(deleteLandingPage)
);

// ─── Recipients ──────────────────────────────────────────────────────────────
phishingRouter.post("/recipients/import",
    isAuthenticated(), isAuthorized(p.recipients.create), isValid(importRecipientsValidation),
    asyncHandler(importRecipients)
);
phishingRouter.get("/recipients",
    isAuthenticated(), isAuthorized(p.recipients.read), isValid(listRecipientsValidation),
    asyncHandler(getRecipients)
);
phishingRouter.get("/recipients/:id",
    isAuthenticated(), isAuthorized(p.recipients.read), isValid(recipientIdValidation),
    asyncHandler(getRecipient)
);
phishingRouter.patch("/recipients/:id",
    isAuthenticated(), isAuthorized(p.recipients.update), isValid(recipientIdValidation), isValid(updateRecipientValidation),
    asyncHandler(updateRecipient)
);
phishingRouter.delete("/recipients/:id",
    isAuthenticated(), isAuthorized(p.recipients.delete), isValid(recipientIdValidation),
    asyncHandler(deleteRecipient)
);

// ─── Campaigns ───────────────────────────────────────────────────────────────
phishingRouter.post("/campaigns",
    isAuthenticated(), isAuthorized(p.campaigns.create), isValid(createCampaignValidation),
    asyncHandler(createCampaign)
);
phishingRouter.get("/campaigns",
    isAuthenticated(), isAuthorized(p.campaigns.read), isValid(listQueryValidation),
    asyncHandler(getCampaigns)
);
phishingRouter.get("/campaigns/:id",
    isAuthenticated(), isAuthorized(p.campaigns.read), isValid(campaignIdValidation),
    asyncHandler(getCampaign)
);
phishingRouter.patch("/campaigns/:id",
    isAuthenticated(), isAuthorized(p.campaigns.update), isValid(campaignIdValidation), isValid(updateCampaignValidation),
    asyncHandler(updateCampaign)
);
phishingRouter.delete("/campaigns/:id",
    isAuthenticated(), isAuthorized(p.campaigns.delete), isValid(campaignIdValidation),
    asyncHandler(deleteCampaign)
);
phishingRouter.post("/campaigns/:id/recipients",
    isAuthenticated(), isAuthorized(p.campaigns.manage), isValid(campaignIdValidation), isValid(addCampaignRecipientsValidation),
    asyncHandler(addCampaignRecipients)
);
phishingRouter.post("/campaigns/:id/launch",
    isAuthenticated(), isAuthorized(p.campaigns.launch), isValid(campaignIdValidation), isValid(launchCampaignValidation),
    asyncHandler(launchCampaign)
);
phishingRouter.post("/campaigns/:id/pause",
    isAuthenticated(), isAuthorized(p.campaigns.manage), isValid(campaignIdValidation),
    asyncHandler(pauseCampaign)
);
phishingRouter.post("/campaigns/:id/resume",
    isAuthenticated(), isAuthorized(p.campaigns.manage), isValid(campaignIdValidation),
    asyncHandler(resumeCampaign)
);
phishingRouter.post("/campaigns/:id/stop",
    isAuthenticated(), isAuthorized(p.campaigns.manage), isValid(campaignIdValidation),
    asyncHandler(stopCampaign)
);

const trackingRateLimit = rateLimit({ windowMs: 60_000, max: 120 });

// ─── Tracking (public) ───────────────────────────────────────────────────────
phishingRouter.get("/track/open/:trackingId",
    trackingRateLimit,
    isValid(trackingIdParamValidation),
    asyncHandler(trackOpen)
);
phishingRouter.get("/track/click/:trackingId",
    trackingRateLimit,
    isValid(trackingIdParamValidation),
    asyncHandler(trackClick)
);
phishingRouter.post("/track/visit/:trackingId",
    trackingRateLimit,
    isValid(trackingIdParamValidation),
    asyncHandler(trackVisit)
);
phishingRouter.post("/track/submit/:trackingId",
    trackingRateLimit,
    isValid(trackSubmitValidation),
    asyncHandler(trackSubmit)
);
phishingRouter.post("/track/download/:trackingId",
    trackingRateLimit,
    isValid(trackDownloadValidation),
    asyncHandler(trackDownload)
);

// ─── Reports ─────────────────────────────────────────────────────────────────
phishingRouter.post("/reports/:campaignId/generate",
    isAuthenticated(), isAuthorized(p.reports.generate), isValid(campaignIdParamValidation),
    asyncHandler(generateReport)
);
phishingRouter.get("/reports/:campaignId/download",
    isAuthenticated(), isAuthorized(p.reports.read), isValid(campaignIdParamValidation),
    asyncHandler(downloadReport)
);
phishingRouter.get("/reports/:campaignId/stats",
    isAuthenticated(), isAuthorized(p.reports.read), isValid(campaignIdParamValidation),
    asyncHandler(getReportStats)
);

// ─── Dashboard ───────────────────────────────────────────────────────────────
phishingRouter.get("/dashboard/overview",
    isAuthenticated(), isAuthorized(p.dashboard.read),
    asyncHandler(getDashboardOverview)
);
phishingRouter.get("/dashboard/risks",
    isAuthenticated(), isAuthorized(p.dashboard.read),
    asyncHandler(getDashboardRisks)
);
phishingRouter.get("/dashboard/departments",
    isAuthenticated(), isAuthorized(p.dashboard.read),
    asyncHandler(getDashboardDepartments)
);
phishingRouter.get("/dashboard/trends",
    isAuthenticated(), isAuthorized(p.dashboard.read), isValid(dashboardTrendsValidation),
    asyncHandler(getDashboardTrends)
);

// ─── Integrations ────────────────────────────────────────────────────────────
phishingRouter.post("/integrations/grc/risk",
    isServiceOrUserAuthenticated(), isAuthorized(p.integrations.manage), isValid(grcRiskIntegrationValidation),
    asyncHandler(integrateGrcRisk)
);
phishingRouter.post("/integrations/soar/incident",
    isServiceOrUserAuthenticated(), isAuthorized(p.integrations.manage), isValid(soarIncidentIntegrationValidation),
    asyncHandler(integrateSoarIncident)
);
phishingRouter.post("/integrations/siem/event",
    isServiceOrUserAuthenticated(), isAuthorized(p.integrations.manage), isValid(siemEventIntegrationValidation),
    asyncHandler(integrateSiemEvent)
);
phishingRouter.post("/integrations/opencti/indicator",
    isServiceOrUserAuthenticated(), isAuthorized(p.integrations.manage), isValid(openctiIndicatorValidation),
    asyncHandler(integrateOpenCtiIndicator)
);

export default phishingRouter;
