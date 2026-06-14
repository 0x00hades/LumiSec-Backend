import dotenv from "dotenv";
import { trackingQueue } from "../utils/queue.js";
import { connectDB } from "../../database/connection.js";
import { logger } from "../utils/logger.js";
import { emitAlert } from "../utils/socket.js";
import { forwardPhishingEventToSiem } from "../integrations/phishingSiem.js";
import * as trackingService from "../modules/phishing/services/tracking.service.js";
import * as riskService from "../modules/phishing/services/risk.service.js";
import { Recipient, Campaign } from "../../database/index.js";

dotenv.config({ path: "./config/.env" });
await connectDB();

trackingQueue.process("processTrackingEvent", async (job) => {
    const { recipientId, campaignId, eventType, ipAddress, userAgent, metadata } = job.data;

    const event = await trackingService.processTrackingEvent({
        recipientId,
        campaignId,
        eventType,
        ipAddress,
        userAgent,
        metadata
    });

    if (!event) return null;

    await forwardPhishingEventToSiem({
        eventType,
        campaignId,
        recipientId,
        ipAddress,
        userAgent,
        timestamp: event.timestamp,
        metadata
    });

    const recipient = await riskService.applyRiskPenalty(recipientId, eventType);

    if (recipient) {
        const campaign = await Campaign.findById(campaignId).select("createdBy");

        await riskService.evaluateAutoRisk({
            recipientId,
            campaignId,
            eventType,
            clickCount: recipient.clickCount,
            riskScore: recipient.riskScore,
            userId: campaign?.createdBy
        });

        emitAlert("soc_analyst", "phishing:event", {
            campaignId,
            email: recipient.email,
            eventType,
            riskScore: recipient.riskScore
        });
    }

    logger.info(`Tracking event processed: ${eventType} for recipient ${recipientId}`);
    return event;
});

logger.info("Tracking worker started");
