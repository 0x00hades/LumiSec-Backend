import { indexDocument } from "./elk.js";
import { logger } from "../utils/logger.js";

const PHISHING_SIEM_INDEX = process.env.PHISHING_SIEM_INDEX || "lumisec-phishing-events";

export const forwardPhishingEventToSiem = async (event) => {
    try {
        await indexDocument(PHISHING_SIEM_INDEX, {
            "@timestamp": event.timestamp || new Date().toISOString(),
            event_type: event.eventType,
            campaign_id: String(event.campaignId),
            recipient_id: String(event.recipientId),
            ip_address: event.ipAddress,
            user_agent: event.userAgent,
            metadata: event.metadata || {},
            source: "lumisec-phishing"
        });
    } catch (error) {
        logger.error("Failed to forward phishing event to SIEM", {
            message: error.message,
            eventType: event.eventType
        });
    }
};
