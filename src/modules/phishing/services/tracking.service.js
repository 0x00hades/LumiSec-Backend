import {
    Recipient, Campaign, PhishingEvent, CredentialCapture
} from "../../../../database/index.js";
import { AppError } from "../../../utils/appError.js";
import { messages } from "../../../utils/constant/messages.js";
import {
    phishingEventType, recipientStatus, campaignStatus
} from "../../../utils/constant/enums.js";
import { trackingQueue } from "../../../utils/queue.js";

const TRACKING_PIXEL = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64");

const recipientUpdates = {
    [phishingEventType.EMAIL_OPENED]: { opened: true, status: recipientStatus.OPENED },
    [phishingEventType.LINK_CLICKED]: { clicked: true, status: recipientStatus.CLICKED },
    [phishingEventType.FORM_VISITED]: { status: recipientStatus.CLICKED },
    [phishingEventType.CREDENTIAL_SUBMITTED]: { submitted: true, status: recipientStatus.SUBMITTED },
    [phishingEventType.ATTACHMENT_DOWNLOADED]: { clicked: true },
    [phishingEventType.QR_SCANNED]: { clicked: true }
};

const campaignIncrements = {
    [phishingEventType.EMAIL_SENT]: { sentCount: 1 },
    [phishingEventType.EMAIL_OPENED]: { openedCount: 1 },
    [phishingEventType.LINK_CLICKED]: { clickedCount: 1 },
    [phishingEventType.FORM_VISITED]: { clickedCount: 1 },
    [phishingEventType.CREDENTIAL_SUBMITTED]: { submittedCount: 1 },
    [phishingEventType.ATTACHMENT_DOWNLOADED]: { clickedCount: 1 },
    [phishingEventType.QR_SCANNED]: { clickedCount: 1 }
};

export const resolveRecipient = async (trackingId) => {
    const recipient = await Recipient.findOne({ trackingId });
    if (!recipient) throw new AppError("Invalid tracking ID", 404);
    return recipient;
};

export const queueTrackingEvent = async ({
    trackingId,
    eventType,
    ipAddress,
    userAgent,
    metadata = {}
}) => {
    const recipient = await resolveRecipient(trackingId);

    const campaign = await Campaign.findById(recipient.campaignId);
    if (campaign?.status === campaignStatus.PAUSED) {
        throw new AppError("Campaign is paused", 403);
    }

    await trackingQueue.add("processTrackingEvent", {
        trackingId,
        eventType,
        ipAddress,
        userAgent,
        metadata,
        recipientId: recipient._id,
        campaignId: recipient.campaignId
    });

    return recipient;
};

export const processTrackingEvent = async ({
    recipientId,
    campaignId,
    eventType,
    ipAddress,
    userAgent,
    metadata
}) => {
    const recipient = await Recipient.findById(recipientId);
    if (!recipient) return null;

    const event = await PhishingEvent.create({
        campaignId,
        recipientId,
        eventType,
        ipAddress,
        userAgent,
        timestamp: new Date(),
        metadata
    });

    const updates = recipientUpdates[eventType] || {};
    Object.assign(recipient, updates);

    if (eventType === phishingEventType.LINK_CLICKED) {
        recipient.clickCount = (recipient.clickCount || 0) + 1;
    }

    await recipient.save();

    const inc = campaignIncrements[eventType];
    if (inc) {
        await Campaign.findByIdAndUpdate(campaignId, { $inc: inc });
    }

    if (eventType === phishingEventType.CREDENTIAL_SUBMITTED && metadata?.username) {
        await CredentialCapture.create({
            campaignId,
            recipientId,
            username: metadata.username,
            timestamp: new Date()
        });
    }

    return event;
};

export const trackOpen = async (trackingId, req) => {
    await queueTrackingEvent({
        trackingId,
        eventType: phishingEventType.EMAIL_OPENED,
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"]
    });
    return TRACKING_PIXEL;
};

export const trackClick = async (trackingId, req) => {
    const recipient = await queueTrackingEvent({
        trackingId,
        eventType: phishingEventType.LINK_CLICKED,
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
        metadata: { url: req.query.url }
    });

    const redirect = req.query.url || "/";
    return { recipient, redirect };
};

export const trackVisit = async (trackingId, req) => {
    await queueTrackingEvent({
        trackingId,
        eventType: phishingEventType.FORM_VISITED,
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"]
    });
};

export const trackSubmit = async (trackingId, req) => {
    const { username } = req.body;
    await queueTrackingEvent({
        trackingId,
        eventType: phishingEventType.CREDENTIAL_SUBMITTED,
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
        metadata: { username }
    });
};

export const trackDownload = async (trackingId, req) => {
    await queueTrackingEvent({
        trackingId,
        eventType: phishingEventType.ATTACHMENT_DOWNLOADED,
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
        metadata: { attachment: req.body.attachment }
    });
};
