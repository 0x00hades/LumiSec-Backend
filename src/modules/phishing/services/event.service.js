import { PhishingEvent } from "../../../../database/index.js";

export const listEvents = async ({ page = 1, limit = 50, campaignId, eventType } = {}) => {
    const filter = {};
    if (campaignId) filter.campaignId = campaignId;
    if (eventType) filter.eventType = eventType;

    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
        PhishingEvent.find(filter)
            .sort({ timestamp: -1 })
            .skip(skip)
            .limit(limit)
            .populate("recipientId", "email fullName department")
            .populate("campaignId", "name")
            .lean(),
        PhishingEvent.countDocuments(filter)
    ]);

    return { data, page, limit, total };
};
