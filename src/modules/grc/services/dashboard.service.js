import { Finding, Risk, RemediationTask, ComplianceControl } from "../../../../database/index.js";
import { findingStatus, riskStatus, taskStatus, controlStatus } from "../../../utils/constant/enums.js";

export const getOverview = async () => {
    const [findingsByStatus, findingsBySeverity, openFindings, totalRisks, openTasks] = await Promise.all([
        Finding.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
        Finding.aggregate([{ $group: { _id: "$severity", count: { $sum: 1 } } }]),
        Finding.countDocuments({ status: { $in: [findingStatus.OPEN, findingStatus.IN_PROGRESS, findingStatus.REOPENED] } }),
        Risk.countDocuments({ status: riskStatus.OPEN }),
        RemediationTask.countDocuments({ status: { $in: [taskStatus.OPEN, taskStatus.IN_PROGRESS] } })
    ]);

    return {
        openFindings,
        totalRisks,
        openTasks,
        findingsByStatus,
        findingsBySeverity
    };
};

export const getRiskDashboard = async () => {
    const [byLevel, byStatus, byTreatment, topRisks] = await Promise.all([
        Risk.aggregate([{ $group: { _id: "$riskLevel", count: { $sum: 1 } } }]),
        Risk.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
        Risk.aggregate([{ $group: { _id: "$treatment", count: { $sum: 1 } } }]),
        Risk.find({ status: riskStatus.OPEN }).sort({ score: -1 }).limit(10).select("title score riskLevel status treatment")
    ]);

    return { byLevel, byStatus, byTreatment, topRisks };
};

export const getComplianceDashboard = async () => {
    const [byFramework, byStatus] = await Promise.all([
        ComplianceControl.aggregate([
            { $group: { _id: "$framework", total: { $sum: 1 }, compliant: { $sum: { $cond: [{ $eq: ["$status", controlStatus.COMPLIANT] }, 1, 0] } } } },
            { $project: { framework: "$_id", total: 1, compliant: 1, complianceRate: { $cond: [{ $eq: ["$total", 0] }, 0, { $multiply: [{ $divide: ["$compliant", "$total"] }, 100] }] }, _id: 0 } }
        ]),
        ComplianceControl.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }])
    ]);

    return { byFramework, byStatus };
};

export const getTasksDashboard = async () => {
    const [byStatus, byPriority, overdue] = await Promise.all([
        RemediationTask.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
        RemediationTask.aggregate([{ $group: { _id: "$priority", count: { $sum: 1 } } }]),
        RemediationTask.countDocuments({
            dueDate: { $lt: new Date() },
            status: { $in: [taskStatus.OPEN, taskStatus.IN_PROGRESS] }
        })
    ]);

    return { byStatus, byPriority, overdue };
};

export const getRiskHeatmap = async () => {
    const heatmap = await Risk.aggregate([
        { $match: { status: { $ne: riskStatus.CLOSED } } },
        {
            $group: {
                _id: { likelihood: "$likelihood", impact: "$impact" },
                count: { $sum: 1 },
                avgScore: { $avg: "$score" }
            }
        },
        { $sort: { "_id.likelihood": 1, "_id.impact": 1 } }
    ]);

    const matrix = Array.from({ length: 5 }, (_, li) =>
        Array.from({ length: 5 }, (_, im) => {
            const cell = heatmap.find((h) => h._id.likelihood === li + 1 && h._id.impact === im + 1);
            return {
                likelihood: li + 1,
                impact: im + 1,
                count: cell?.count || 0,
                avgScore: cell?.avgScore || 0
            };
        })
    );

    return { heatmap, matrix };
};
