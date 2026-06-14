import {
    Campaign, Recipient, EmailTemplate, LandingPage
} from "../../../../database/index.js";
import { AppError } from "../../../utils/appError.js";
import { messages } from "../../../utils/constant/messages.js";
import { campaignStatus } from "../../../utils/constant/enums.js";
import { parsePagination } from "../../../utils/pagination.js";
import { emailQueue } from "../../../utils/queue.js";
import { generateTrackingId } from "../helpers/trackingId.js";

const LAUNCHABLE = [campaignStatus.DRAFT, campaignStatus.SCHEDULED];
const PAUSABLE = [campaignStatus.RUNNING];
const RESUMABLE = [campaignStatus.PAUSED];
const STOPPABLE = [campaignStatus.RUNNING, campaignStatus.PAUSED, campaignStatus.SCHEDULED];

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

export const addRecipientsToCampaign = async (campaignId, recipients) => {
    const campaign = await Campaign.findById(campaignId);
    if (!campaign) throw new AppError(messages.campaign.notFound, 404);

    const docs = recipients.map((r) => ({
        campaignId,
        fullName: r.fullName,
        email: r.email.toLowerCase(),
        department: r.department,
        jobTitle: r.jobTitle,
        manager: r.manager,
        trackingId: generateTrackingId()
    }));

    const created = await Recipient.insertMany(docs);
    campaign.recipientsCount = await Recipient.countDocuments({ campaignId });
    await campaign.save();

    return { added: created.length, recipients: created };
};

export const launchCampaign = async (campaignId, trackingDomain) => {
    const campaign = await Campaign.findById(campaignId).populate("templateId");
    if (!campaign) throw new AppError(messages.campaign.notFound, 404);
    if (!LAUNCHABLE.includes(campaign.status)) {
        throw new AppError(messages.campaign.invalidStatus, 400);
    }

    const recipients = await Recipient.find({ campaignId, emailSent: false });
    if (!recipients.length) throw new AppError("No recipients found for this campaign", 400);

    const domain = trackingDomain || campaign.trackingDomain || process.env.PHISHING_TRACKING_DOMAIN || "http://localhost:3000/api/phishing";

    for (const recipient of recipients) {
        await emailQueue.add("sendPhishingEmail", {
            recipientId: recipient._id,
            campaignId,
            to: recipient.email,
            subject: campaign.templateId.subject,
            htmlBody: campaign.templateId.htmlBody,
            from: process.env.SMTP_FROM || "LumiSec <noreply@lumisec.io>",
            trackingId: recipient.trackingId,
            trackingDomain: domain
        });
    }

    campaign.status = campaignStatus.RUNNING;
    campaign.launchDate = new Date();
    if (trackingDomain) campaign.trackingDomain = trackingDomain;
    await campaign.save();

    return { queued: recipients.length, campaign };
};

export const pauseCampaign = async (campaignId) => {
    const campaign = await Campaign.findById(campaignId);
    if (!campaign) throw new AppError(messages.campaign.notFound, 404);
    if (!PAUSABLE.includes(campaign.status)) throw new AppError(messages.campaign.invalidStatus, 400);

    campaign.status = campaignStatus.PAUSED;
    await campaign.save();
    return campaign;
};

export const resumeCampaign = async (campaignId) => {
    const campaign = await Campaign.findById(campaignId);
    if (!campaign) throw new AppError(messages.campaign.notFound, 404);
    if (!RESUMABLE.includes(campaign.status)) throw new AppError(messages.campaign.invalidStatus, 400);

    campaign.status = campaignStatus.RUNNING;
    await campaign.save();
    return campaign;
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
