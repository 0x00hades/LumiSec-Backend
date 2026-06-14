import dotenv from "dotenv";
import { emailQueue, trackingQueue } from "../utils/queue.js";
import { sendPhishingEmail } from "../integrations/mailer.js";
import { Recipient, Campaign } from "../../database/index.js";
import { connectDB } from "../../database/connection.js";
import { logger } from "../utils/logger.js";
import { recipientStatus, phishingEventType } from "../utils/constant/enums.js";
import * as trackingService from "../modules/phishing/services/tracking.service.js";

dotenv.config({ path: "./config/.env" });
await connectDB();

emailQueue.process("sendPhishingEmail", async (job) => {
    const { recipientId, campaignId, to, subject, htmlBody, from, trackingId, trackingDomain } = job.data;

    await sendPhishingEmail({ to, subject, htmlBody, from, trackingId, trackingDomain });

    await Recipient.findByIdAndUpdate(recipientId, {
        emailSent: true,
        sentAt: new Date(),
        status: recipientStatus.SENT
    });

    await Campaign.findByIdAndUpdate(campaignId, { $inc: { sentCount: 1 } });

    await trackingQueue.add("processTrackingEvent", {
        recipientId,
        campaignId,
        eventType: phishingEventType.EMAIL_SENT,
        ipAddress: null,
        userAgent: "email-worker",
        metadata: { to }
    });

    logger.info(`Phishing email sent to ${to}`);
});

logger.info("Email worker started");
