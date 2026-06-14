import dotenv from "dotenv";
import { riskQueue } from "../utils/queue.js";
import { connectDB } from "../../database/connection.js";
import { logger } from "../utils/logger.js";
import * as riskService from "../modules/phishing/services/risk.service.js";
import * as integrationService from "../modules/phishing/services/integration.service.js";
import { Recipient, Campaign } from "../../database/index.js";

dotenv.config({ path: "./config/.env" });
await connectDB();

riskQueue.process("createPhishingRisk", async (job) => {
    const { recipientId, campaignId, reason, eventType, userId } = job.data;

    const recipient = await Recipient.findById(recipientId);
    if (!recipient) throw new Error("Recipient not found");

    const campaign = await Campaign.findById(campaignId).select("createdBy");
    const ownerId = userId || campaign?.createdBy;
    if (!ownerId) throw new Error("No owner available for phishing risk");

    const result = await riskService.createPhishingRisk({
        recipientId,
        campaignId,
        reason,
        eventType,
        userId: ownerId
    });

    await integrationService.autoIntegrateOnRisk({
        phishingRisk: result.phishingRisk,
        recipient,
        eventType,
        userId: ownerId
    });

    logger.info(`Phishing risk created: ${result.phishingRisk._id} (${reason})`);
    return result;
});

logger.info("Risk worker started");
