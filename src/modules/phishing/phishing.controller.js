import { Campaign, Recipient, PhishingEvent } from "../../../database/index.js";
import { AppError } from "../../utils/appError.js";
import { successResponse, paginatedResponse } from "../../utils/apiResponse.js";
import { messages } from "../../utils/constant/messages.js";
import { emailQueue } from "../../utils/queue.js";
import { emitAlert } from "../../utils/socket.js";
import { calculatePenalty } from "../../utils/helpers/penaltyCalc.js";
import { campaignStatus } from "../../utils/constant/enums.js";

export const createCampaign = async (req, res, next) => {
    const { name, description, template, landingPageUrl, trackingDomain } = req.body;
    const createdBy = req.authUser._id;

    const campaign = await Campaign.create({ name, description, template, landingPageUrl, trackingDomain, createdBy });

    return successResponse(res, {
        message: messages.campaign.createdSuccessfully,
        data: campaign,
        statusCode: 201
    });
};

export const launchCampaign = async (req, res, next) => {
    const { campaignId } = req.params;

    const campaign = await Campaign.findById(campaignId);
    if (!campaign) return next(new AppError(messages.campaign.notFound, 404));
    if (campaign.status !== campaignStatus.DRAFT) {
        return next(new AppError("Campaign already launched", 400));
    }

    const recipients = await Recipient.find({ campaign: campaignId, emailSent: false });
    if (!recipients.length) return next(new AppError("No recipients found for this campaign", 400));

    // Queue all emails
    for (const recipient of recipients) {
        await emailQueue.add("sendPhishingEmail", {
            recipientId: recipient._id,
            campaignId,
            to: recipient.email,
            subject: campaign.template.subject,
            htmlBody: campaign.template.htmlBody,
            from: `${campaign.template.senderName} <${campaign.template.senderEmail}>`,
            trackingId: recipient.trackingId,
            trackingDomain: campaign.trackingDomain
        });
    }

    campaign.status = campaignStatus.ACTIVE;
    campaign.launchedAt = new Date();
    await campaign.save();

    return successResponse(res, {
        message: messages.campaign.launchedSuccessfully,
        data: { queued: recipients.length }
    });
};

export const trackEvent = async (req, res, next) => {
    const { trackingId } = req.params;
    const { type } = req.body;

    const recipient = await Recipient.findOne({ trackingId });
    if (!recipient) return next(new AppError("Invalid tracking ID", 404));

    const penalty = calculatePenalty(type);

    // Record event
    await PhishingEvent.create({
        recipient: recipient._id,
        campaign: recipient.campaign,
        type,
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
        penalty
    });

    // Deduct risk score
    recipient.riskScore = Math.max(0, recipient.riskScore - penalty);
    await recipient.save();

    // Update campaign stats
    await Campaign.findByIdAndUpdate(recipient.campaign, { $inc: { [`stats.${type}s`]: 1 } });

    // Real-time alert to SOC
    emitAlert("soc_analyst", "phishing:event", {
        campaignId: recipient.campaign,
        email: recipient.email,
        type,
        riskScore: recipient.riskScore
    });

    // Return 1x1 pixel for open tracking
    if (type === "open") {
        res.set("Content-Type", "image/gif");
        return res.send(Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64"));
    }

    return successResponse(res, { message: "Event tracked", data: null });
};

export const getCampaigns = async (req, res, next) => {
    const { page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;

    const [campaigns, total] = await Promise.all([
        Campaign.find().sort({ createdAt: -1 }).skip(skip).limit(Number(limit)).populate("createdBy", "name email"),
        Campaign.countDocuments()
    ]);

    return paginatedResponse(res, { message: "Campaigns fetched", data: campaigns, page: Number(page), limit: Number(limit), total });
};
