import {
    Recipient, Campaign, PhishingEvent, CredentialCapture
} from "../../../../database/index.js";
import { AppError } from "../../../utils/appError.js";
import { messages } from "../../../utils/constant/messages.js";
import {
    phishingEventType, recipientStatus
} from "../../../utils/constant/enums.js";
import { trackingQueue } from "../../../utils/queue.js";
import { logger } from "../../../utils/logger.js";
import { injectLandingTrackingScript } from "../helpers/landingPageHtml.js";
import { resolveTrackingBaseSync } from "../helpers/trackingDomain.js";

const TRACKING_PIXEL = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64");

const recipientUpdates = {
    [phishingEventType.EMAIL_OPENED]: { opened: true, status: recipientStatus.OPENED },
    [phishingEventType.LINK_CLICKED]: { clicked: true, status: recipientStatus.CLICKED },
    [phishingEventType.FORM_VISITED]: { clicked: true, status: recipientStatus.CLICKED },
    [phishingEventType.CREDENTIAL_SUBMITTED]: { submitted: true, status: recipientStatus.SUBMITTED },
    [phishingEventType.ATTACHMENT_DOWNLOADED]: { clicked: true },
    [phishingEventType.QR_SCANNED]: { clicked: true }
};

const impliesOpen = new Set([
    phishingEventType.LINK_CLICKED,
    phishingEventType.FORM_VISITED,
    phishingEventType.CREDENTIAL_SUBMITTED,
    phishingEventType.ATTACHMENT_DOWNLOADED,
    phishingEventType.QR_SCANNED
]);

function buildCampaignIncrements(eventType, { wasOpened, wasClicked, wasSubmitted }) {
    const inc = {};

    if (eventType === phishingEventType.EMAIL_OPENED && !wasOpened) {
        inc.openedCount = 1;
    }

    if (impliesOpen.has(eventType) && !wasOpened) {
        inc.openedCount = 1;
    }

    const clickTypes = new Set([
        phishingEventType.LINK_CLICKED,
        phishingEventType.FORM_VISITED,
        phishingEventType.ATTACHMENT_DOWNLOADED,
        phishingEventType.QR_SCANNED
    ]);
    if (clickTypes.has(eventType) && !wasClicked) {
        inc.clickedCount = 1;
    }

    if (eventType === phishingEventType.CREDENTIAL_SUBMITTED && !wasSubmitted) {
        inc.submittedCount = 1;
    }

    return inc;
}

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

    const wasOpened = recipient.opened;
    const wasClicked = recipient.clicked;
    const wasSubmitted = recipient.submitted;

    const updates = recipientUpdates[eventType] || {};
    Object.assign(recipient, updates);

    if (eventType === phishingEventType.LINK_CLICKED) {
        recipient.clickCount = (recipient.clickCount || 0) + 1;
    }

    if (impliesOpen.has(eventType) && !recipient.opened) {
        recipient.opened = true;
        if ([recipientStatus.PENDING, recipientStatus.SENT].includes(recipient.status)) {
            recipient.status = recipientStatus.OPENED;
        }
    }

    await recipient.save();

    const inc = buildCampaignIncrements(eventType, { wasOpened, wasClicked, wasSubmitted });
    if (Object.keys(inc).length) {
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
    try {
        await queueTrackingEvent({
            trackingId,
            eventType: phishingEventType.EMAIL_OPENED,
            ipAddress: req.ip,
            userAgent: req.headers["user-agent"]
        });
    } catch (err) {
        // Always return the pixel — mail clients must get a 200 + GIF even if queue/DB fails.
        logger.warn(`Open pixel queued with error for ${trackingId}: ${err.message}`);
    }
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

    const rawUrl = req.query.url || "/";
    let redirect = rawUrl;
    try {
        redirect = decodeURIComponent(rawUrl);
    } catch {
        redirect = rawUrl;
    }
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

export const serveLandingPage = async (trackingId, req) => {
    const recipient = await resolveRecipient(trackingId);
    const campaign = await Campaign.findById(recipient.campaignId).populate("landingPageId");

    if (!campaign?.landingPageId) {
        throw new AppError("No landing page configured for this campaign", 404);
    }

    await queueTrackingEvent({
        trackingId,
        eventType: phishingEventType.FORM_VISITED,
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"]
    });

    const apiBase = resolveTrackingBaseSync(campaign.trackingDomain);

    const page = campaign.landingPageId;
    const html = injectLandingTrackingScript(page.htmlContent, {
        trackingId,
        apiBase,
        redirectUrl: page.redirectUrl
    });

    return { html, title: page.title || page.name };
};
