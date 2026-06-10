import { emailQueue } from "../utils/queue.js";
import { sendPhishingEmail } from "../integrations/mailer.js";
import { Recipient } from "../../database/index.js";
import { logger } from "../utils/logger.js";

emailQueue.process("sendPhishingEmail", async (job) => {
    const { recipientId, to, subject, htmlBody, from, trackingId, trackingDomain } = job.data;

    await sendPhishingEmail({ to, subject, htmlBody, from, trackingId, trackingDomain });

    await Recipient.findByIdAndUpdate(recipientId, { emailSent: true, sentAt: new Date() });
    logger.info(`Phishing email sent to ${to}`);
});

logger.info("Email worker started");
