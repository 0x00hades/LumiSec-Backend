import {
    Campaign, Recipient, EmailTemplate, LandingPage
} from "../../../../database/index.js";
import { AppError } from "../../../utils/appError.js";
import { messages } from "../../../utils/constant/messages.js";
import { campaignStatus } from "../../../utils/constant/enums.js";
import { parsePagination } from "../../../utils/pagination.js";
import { emailQueue } from "../../../utils/queue.js";
import { generateTrackingId } from "../helpers/trackingId.js";
import { buildLandingUrl, prepareEmailHtml } from "../helpers/emailContent.js";
import { getFromAddress, getStoredSettings } from "./settings.service.js";
import { resolveTrackingDomainForEmail } from "../helpers/trackingDomain.js";

const LAUNCHABLE = [campaignStatus.DRAFT, campaignStatus.SCHEDULED];
const PAUSABLE = [campaignStatus.RUNNING];
const RESUMABLE = [campaignStatus.PAUSED];
const STOPPABLE = [campaignStatus.RUNNING, campaignStatus.PAUSED, campaignStatus.SCHEDULED];
const ACTIVE_SEND_STATUSES = [campaignStatus.RUNNING];

const loadCampaignForEmail = (campaignId) =>
    Campaign.findById(campaignId)
        .populate("templateId")
        .populate("landingPageId");

const queueEmailsForRecipients = async (campaign, recipients, { req, trackingDomainOverride } = {}) => {
    if (!recipients.length) return 0;

    const populated = campaign.templateId?.htmlBody
        ? campaign
        : await loadCampaignForEmail(campaign._id ?? campaign.id);
    if (!populated?.templateId) throw new AppError(messages.template.notFound, 404);

    const stored = await getStoredSettings();
    const { domain } = await resolveTrackingDomainForEmail({
        override: trackingDomainOverride,
        campaign: populated,
        storedSettings: stored,
        req
    });

    const hasLandingPage = Boolean(populated.landingPageId);
    const fromAddress = await getFromAddress();
    const campaignId = populated._id;

    for (const recipient of recipients) {
        const landingUrl = hasLandingPage ? buildLandingUrl(domain, recipient.trackingId) : null;
        const htmlBody = prepareEmailHtml(
            populated.templateId.htmlBody,
            recipient,
            landingUrl
        );

        await emailQueue.add(
            "sendPhishingEmail",
            {
                recipientId: recipient._id,
                campaignId,
                to: recipient.email,
                subject: populated.templateId.subject,
                htmlBody,
                from: fromAddress,
                trackingId: recipient.trackingId,
                trackingDomain: domain
            },
            { jobId: `phishing-email-${recipient._id}` }
        );
    }

    return recipients.length;
};

export const createCampaign = async (data, user) => {
    const template = await EmailTemplate.findById(data.templateId);
    if (!template) throw new AppError(messages.template.notFound, 404);

    if (data.landingPageId) {
        const page = await LandingPage.findById(data.landingPageId);
        if (!page) throw new AppError(messages.landingPage.notFound, 404);
    }

    return Campaign.create({ ...data, createdBy: user._id });
};

export const listCampaigns = async (query) => {
    const { page, limit, skip, sort } = parsePagination(query);
    const filter = {};
    if (query.status) filter.status = query.status;

    const [data, total] = await Promise.all([
        Campaign.find(filter)
            .sort(sort)
            .skip(skip)
            .limit(limit)
            .populate("createdBy", "name email")
            .populate("templateId", "name subject")
            .populate("landingPageId", "name title"),
        Campaign.countDocuments(filter)
    ]);

    return { data, page, limit, total };
};

export const getCampaignById = async (id) => {
    const campaign = await Campaign.findById(id)
        .populate("createdBy", "name email")
        .populate("templateId")
        .populate("landingPageId");

    if (!campaign) throw new AppError(messages.campaign.notFound, 404);
    return campaign;
};

export const updateCampaign = async (id, updates) => {
    const campaign = await Campaign.findById(id);
    if (!campaign) throw new AppError(messages.campaign.notFound, 404);

    if ([campaignStatus.RUNNING, campaignStatus.COMPLETED].includes(campaign.status)) {
        throw new AppError("Cannot update a running or completed campaign", 400);
    }

    if (updates.templateId) {
        const template = await EmailTemplate.findById(updates.templateId);
        if (!template) throw new AppError(messages.template.notFound, 404);
    }

    Object.assign(campaign, updates);
    await campaign.save();
    return campaign;
};

export const deleteCampaign = async (id) => {
    const campaign = await Campaign.findByIdAndDelete(id);
    if (!campaign) throw new AppError(messages.campaign.notFound, 404);
    await Recipient.deleteMany({ campaignId: id });
    return campaign;
};

export const addRecipientsToCampaign = async (campaignId, recipients, req) => {
    const campaign = await Campaign.findById(campaignId);
    if (!campaign) throw new AppError(messages.campaign.notFound, 404);

    const existing = await Recipient.find({ campaignId }).select("email").lean();
    const existingEmails = new Set(existing.map((r) => r.email.toLowerCase()));

    const toCreate = recipients
        .map((r) => ({
            campaignId,
            fullName: r.fullName,
            email: r.email.toLowerCase(),
            department: r.department,
            jobTitle: r.jobTitle,
            manager: r.manager,
            trackingId: generateTrackingId()
        }))
        .filter((r) => r.email && !existingEmails.has(r.email));

    if (!toCreate.length) {
        return { added: 0, recipients: [], skipped: recipients.length, queued: 0 };
    }

    const created = await Recipient.insertMany(toCreate);
    campaign.recipientsCount = await Recipient.countDocuments({ campaignId });
    await campaign.save();

    let queued = 0;
    if (ACTIVE_SEND_STATUSES.includes(campaign.status)) {
        const populated = await loadCampaignForEmail(campaignId);
        queued = await queueEmailsForRecipients(populated, created, { req });
    }

    return {
        added: created.length,
        skipped: recipients.length - created.length,
        recipients: created,
        queued
    };
};

export const launchCampaign = async (campaignId, trackingDomainOverride, req) => {
    const campaign = await loadCampaignForEmail(campaignId);
    if (!campaign) throw new AppError(messages.campaign.notFound, 404);
    if (!LAUNCHABLE.includes(campaign.status)) {
        throw new AppError(messages.campaign.invalidStatus, 400);
    }

    const recipients = await Recipient.find({ campaignId, emailSent: false });
    if (!recipients.length) throw new AppError("No recipients found for this campaign", 400);

    const stored = await getStoredSettings();
    const { domain } = await resolveTrackingDomainForEmail({
        override: trackingDomainOverride,
        campaign,
        storedSettings: stored,
        req
    });

    const queued = await queueEmailsForRecipients(campaign, recipients, {
        req,
        trackingDomainOverride: domain
    });

    campaign.status = campaignStatus.RUNNING;
    campaign.launchDate = new Date();
    campaign.trackingDomain = domain;
    await campaign.save();

    return { queued, campaign };
};

export const pauseCampaign = async (campaignId) => {
    const campaign = await Campaign.findById(campaignId);
    if (!campaign) throw new AppError(messages.campaign.notFound, 404);
    if (!PAUSABLE.includes(campaign.status)) throw new AppError(messages.campaign.invalidStatus, 400);

    campaign.status = campaignStatus.PAUSED;
    await campaign.save();
    return campaign;
};

export const resumeCampaign = async (campaignId, req) => {
    const campaign = await Campaign.findById(campaignId);
    if (!campaign) throw new AppError(messages.campaign.notFound, 404);
    if (!RESUMABLE.includes(campaign.status)) throw new AppError(messages.campaign.invalidStatus, 400);

    campaign.status = campaignStatus.RUNNING;
    await campaign.save();

    const unsent = await Recipient.find({ campaignId, emailSent: false });
    let queued = 0;
    if (unsent.length) {
        const populated = await loadCampaignForEmail(campaignId);
        queued = await queueEmailsForRecipients(populated, unsent, { req });
    }

    return { campaign, queued };
};

export const stopCampaign = async (campaignId) => {
    const campaign = await Campaign.findById(campaignId);
    if (!campaign) throw new AppError(messages.campaign.notFound, 404);
    if (!STOPPABLE.includes(campaign.status)) throw new AppError(messages.campaign.invalidStatus, 400);

    campaign.status = campaignStatus.CANCELLED;
    campaign.completedAt = new Date();
    await campaign.save();
    return campaign;
};

export const getCampaignStats = async (campaignId) => {
    const campaign = await Campaign.findById(campaignId);
    if (!campaign) throw new AppError(messages.campaign.notFound, 404);

    const sent = campaign.sentCount || 0;
    const opened = campaign.openedCount || 0;
    const clicked = campaign.clickedCount || 0;
    const submitted = campaign.submittedCount || 0;

    return {
        emailsSent: sent,
        opened,
        clicked,
        submitted,
        openRate: sent ? Number(((opened / sent) * 100).toFixed(2)) : 0,
        clickRate: sent ? Number(((clicked / sent) * 100).toFixed(2)) : 0,
        submissionRate: sent ? Number(((submitted / sent) * 100).toFixed(2)) : 0
    };
};
