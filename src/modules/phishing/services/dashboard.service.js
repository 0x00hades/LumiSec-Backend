import {
    Campaign, Recipient, PhishingEvent, PhishingRisk
} from "../../../../database/index.js";
import { campaignStatus, phishingEventType } from "../../../utils/constant/enums.js";

export const getOverview = async () => {
    const [
        totalCampaigns,
        activeCampaigns,
        totalRecipients,
        totalEvents,
        totalRisks
    ] = await Promise.all([
        Campaign.countDocuments(),
        Campaign.countDocuments({ status: campaignStatus.RUNNING }),
        Recipient.countDocuments(),
        PhishingEvent.countDocuments(),
        PhishingRisk.countDocuments()
    ]);

    const campaigns = await Campaign.find().select("sentCount openedCount clickedCount submittedCount").lean();
    const totals = campaigns.reduce((acc, c) => ({
        sent: acc.sent + (c.sentCount || 0),
        opened: acc.opened + (c.openedCount || 0),
        clicked: acc.clicked + (c.clickedCount || 0),
        submitted: acc.submitted + (c.submittedCount || 0)
    }), { sent: 0, opened: 0, clicked: 0, submitted: 0 });

    return {
        totalCampaigns,
        activeCampaigns,
        totalRecipients,
        totalEvents,
        totalRisks,
        engagement: {
            emailsSent: totals.sent,
            opened: totals.opened,
            clicked: totals.clicked,
            submitted: totals.submitted,
            openRate: totals.sent ? Number(((totals.opened / totals.sent) * 100).toFixed(2)) : 0,
            clickRate: totals.sent ? Number(((totals.clicked / totals.sent) * 100).toFixed(2)) : 0,
            submissionRate: totals.sent ? Number(((totals.submitted / totals.sent) * 100).toFixed(2)) : 0
        }
    };
};

export const getRiskDashboard = async () => {
    const byLevel = await PhishingRisk.aggregate([
        { $group: { _id: "$riskLevel", count: { $sum: 1 } } },
        { $sort: { count: -1 } }
    ]);

    const recent = await PhishingRisk.find()
        .sort({ createdAt: -1 })
        .limit(20)
        .populate("recipientId", "email fullName department")
        .populate("campaignId", "name");

    return { byLevel, recent };
};

export const getDepartmentStats = async () => {
    return Recipient.aggregate([
        { $match: { department: { $exists: true, $ne: "" } } },
        {
            $group: {
                _id: "$department",
                recipients: { $sum: 1 },
                opened: { $sum: { $cond: ["$opened", 1, 0] } },
                clicked: { $sum: { $cond: ["$clicked", 1, 0] } },
                submitted: { $sum: { $cond: ["$submitted", 1, 0] } },
                avgRiskScore: { $avg: "$riskScore" }
            }
        },
        { $sort: { recipients: -1 } }
    ]);
};

export const getTrends = async (days = 30) => {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    return PhishingEvent.aggregate([
        { $match: { timestamp: { $gte: since } } },
        {
            $group: {
                _id: {
                    date: { $dateToString: { format: "%Y-%m-%d", date: "$timestamp" } },
                    eventType: "$eventType"
                },
                count: { $sum: 1 }
            }
        },
        { $sort: { "_id.date": 1 } }
    ]);
};
