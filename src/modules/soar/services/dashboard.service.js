import {
    Incident, Playbook, PlaybookRun, Connector,
    IntegrationAction, User, SoarAlert
} from "../../../../database/index.js";
import {
    incidentStatus, incidentSeverity, playbookRunStatus,
    integrationActionStatus, connectorType
} from "../../../utils/constant/enums.js";

const OPEN_STATUSES = [
    incidentStatus.NEW,
    incidentStatus.OPEN,
    incidentStatus.IN_PROGRESS,
    incidentStatus.ESCALATED
];

export const getOverview = async () => {
    const [
        totalIncidents,
        openIncidents,
        criticalOpen,
        totalPlaybooks,
        activePlaybooks,
        activeRuns,
        totalConnectors,
        activeConnectors,
        alertsToday,
        recentIncidents
    ] = await Promise.all([
        Incident.countDocuments(),
        Incident.countDocuments({ status: { $in: OPEN_STATUSES } }),
        Incident.countDocuments({ severity: incidentSeverity.CRITICAL, status: { $in: OPEN_STATUSES } }),
        Playbook.countDocuments(),
        Playbook.countDocuments({ isActive: true }),
        PlaybookRun.countDocuments({ status: { $in: [playbookRunStatus.QUEUED, playbookRunStatus.RUNNING] } }),
        Connector.countDocuments(),
        Connector.countDocuments({ isActive: true }),
        SoarAlert.countDocuments({
            receivedAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
        }),
        Incident.find({ status: { $in: OPEN_STATUSES } })
            .sort({ severity: -1, createdAt: -1 })
            .limit(5)
            .select("title severity status createdAt assignedTo")
            .populate("assignedTo", "name")
    ]);

    const bySeverity = await Incident.aggregate([
        { $match: { status: { $in: OPEN_STATUSES } } },
        { $group: { _id: "$severity", count: { $sum: 1 } } }
    ]);

    return {
        totalIncidents,
        openIncidents,
        criticalOpen,
        totalPlaybooks,
        activePlaybooks,
        activeRuns,
        totalConnectors,
        activeConnectors,
        alertsToday,
        openBySeverity: bySeverity,
        recentIncidents
    };
};

export const getIncidentsDashboard = async () => {
    const [byStatus, bySeverity, byType, mttr, trend] = await Promise.all([
        Incident.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
        Incident.aggregate([{ $group: { _id: "$severity", count: { $sum: 1 } } }]),
        Incident.aggregate([
            { $group: { _id: { $ifNull: ["$incidentType", "unspecified"] }, count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 10 }
        ]),
        Incident.aggregate([
            { $match: { closedAt: { $exists: true } } },
            {
                $project: {
                    resolutionMs: { $subtract: ["$closedAt", "$createdAt"] }
                }
            },
            { $group: { _id: null, avgMs: { $avg: "$resolutionMs" } } }
        ]),
        Incident.aggregate([
            {
                $match: {
                    createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
                }
            },
            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                    count: { $sum: 1 }
                }
            },
            { $sort: { _id: 1 } }
        ])
    ]);

    return {
        byStatus,
        bySeverity,
        byType,
        avgResolutionHours: mttr[0]?.avgMs
            ? Number((mttr[0].avgMs / (1000 * 60 * 60)).toFixed(2))
            : 0,
        trend7d: trend
    };
};

export const getPlaybooksDashboard = async () => {
    const [byStatus, topPlaybooks, recentRuns] = await Promise.all([
        PlaybookRun.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
        PlaybookRun.aggregate([
            { $group: { _id: "$playbookId", runs: { $sum: 1 } } },
            { $sort: { runs: -1 } },
            { $limit: 5 },
            {
                $lookup: {
                    from: "playbooks",
                    localField: "_id",
                    foreignField: "_id",
                    as: "playbook"
                }
            },
            { $unwind: { path: "$playbook", preserveNullAndEmptyArrays: true } },
            { $project: { name: "$playbook.name", runs: 1 } }
        ]),
        PlaybookRun.find()
            .sort({ createdAt: -1 })
            .limit(10)
            .populate("playbookId", "name")
            .populate("incidentId", "title severity")
            .populate("startedBy", "name")
    ]);

    const totalPlaybooks = await Playbook.countDocuments({ isActive: true });

    return { totalActive: totalPlaybooks, runsByStatus: byStatus, topPlaybooks, recentRuns };
};

export const getAutomationDashboard = async () => {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [runsByDay, integrationStats, successRate] = await Promise.all([
        PlaybookRun.aggregate([
            { $match: { createdAt: { $gte: since } } },
            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                    total: { $sum: 1 },
                    completed: {
                        $sum: { $cond: [{ $eq: ["$status", playbookRunStatus.COMPLETED] }, 1, 0] }
                    }
                }
            },
            { $sort: { _id: 1 } }
        ]),
        IntegrationAction.aggregate([
            { $match: { executedAt: { $gte: since } } },
            { $group: { _id: "$status", count: { $sum: 1 } } }
        ]),
        PlaybookRun.aggregate([
            { $match: { createdAt: { $gte: since } } },
            {
                $group: {
                    _id: null,
                    total: { $sum: 1 },
                    completed: {
                        $sum: { $cond: [{ $eq: ["$status", playbookRunStatus.COMPLETED] }, 1, 0] }
                    }
                }
            }
        ])
    ]);

    const total = successRate[0]?.total || 0;
    const completed = successRate[0]?.completed || 0;

    return {
        runsByDay,
        integrationStats,
        automationSuccessRate: total ? Number(((completed / total) * 100).toFixed(2)) : 0,
        totalRuns30d: total,
        completedRuns30d: completed
    };
};

export const getConnectorsDashboard = async () => {
    const [byType, byStatus, recentActions, failing] = await Promise.all([
        Connector.aggregate([
            { $group: { _id: "$type", count: { $sum: 1 }, active: { $sum: { $cond: ["$isActive", 1, 0] } } } }
        ]),
        Connector.aggregate([
            { $group: { _id: "$lastTestStatus", count: { $sum: 1 } } }
        ]),
        IntegrationAction.find()
            .sort({ executedAt: -1 })
            .limit(10)
            .populate("connectorId", "name type")
            .populate("executedBy", "name"),
        Connector.find({ lastTestStatus: "failed", isActive: true })
            .select("name type lastTestedAt lastTestStatus")
    ]);

    return {
        byType,
        testStatus: byStatus,
        recentActions,
        failingConnectors: failing,
        typeLabels: Object.values(connectorType)
    };
};

export const getAnalystsDashboard = async () => {
    const analystRoles = ["soc_analyst", "soc_manager", "senior_analyst"];
    const analysts = await User.find({ role: { $in: analystRoles } }).select("name email role department");

    const workload = await Promise.all(
        analysts.map(async (analyst) => {
            const [assigned, open, closed, runs] = await Promise.all([
                Incident.countDocuments({ assignedTo: analyst._id }),
                Incident.countDocuments({ assignedTo: analyst._id, status: { $in: OPEN_STATUSES } }),
                Incident.countDocuments({
                    assignedTo: analyst._id,
                    status: { $in: [incidentStatus.CLOSED, incidentStatus.RESOLVED] }
                }),
                PlaybookRun.countDocuments({ startedBy: analyst._id })
            ]);

            return {
                analyst: { _id: analyst._id, name: analyst.name, email: analyst.email, role: analyst.role },
                assigned,
                open,
                closed,
                playbookRuns: runs
            };
        })
    );

    return workload.sort((a, b) => b.open - a.open);
};
