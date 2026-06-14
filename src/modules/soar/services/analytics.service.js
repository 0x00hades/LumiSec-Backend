import {
    Incident, PlaybookRun, Playbook, IntegrationAction,
    AnalyticsSnapshot, User
} from "../../../../database/index.js";
import { AppError } from "../../../utils/appError.js";
import {
    incidentStatus, playbookRunStatus, integrationActionStatus
} from "../../../utils/constant/enums.js";
import { analyticsQueue } from "../../../utils/queue.js";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export const getKpis = async (days = 30) => {
    const since = new Date(Date.now() - days * MS_PER_DAY);
    const openStatuses = [
        incidentStatus.NEW,
        incidentStatus.OPEN,
        incidentStatus.IN_PROGRESS,
        incidentStatus.ESCALATED
    ];

    const [
        totalIncidents,
        openIncidents,
        closedIncidents,
        criticalIncidents,
        totalRuns,
        successfulRuns,
        avgResolution
    ] = await Promise.all([
        Incident.countDocuments({ createdAt: { $gte: since } }),
        Incident.countDocuments({ status: { $in: openStatuses } }),
        Incident.countDocuments({
            status: { $in: [incidentStatus.CLOSED, incidentStatus.RESOLVED, incidentStatus.FALSE_POSITIVE] },
            createdAt: { $gte: since }
        }),
        Incident.countDocuments({ severity: "critical", status: { $in: openStatuses } }),
        PlaybookRun.countDocuments({ createdAt: { $gte: since } }),
        PlaybookRun.countDocuments({ status: playbookRunStatus.COMPLETED, createdAt: { $gte: since } }),
        Incident.aggregate([
            {
                $match: {
                    closedAt: { $exists: true, $gte: since },
                    createdAt: { $gte: since }
                }
            },
            {
                $project: {
                    resolutionMs: { $subtract: ["$closedAt", "$createdAt"] }
                }
            },
            { $group: { _id: null, avgMs: { $avg: "$resolutionMs" } } }
        ])
    ]);

    const avgResolutionHours = avgResolution[0]?.avgMs
        ? Number((avgResolution[0].avgMs / (1000 * 60 * 60)).toFixed(2))
        : 0;

    const automationRate = totalRuns
        ? Number(((successfulRuns / totalRuns) * 100).toFixed(2))
        : 0;

    return {
        periodDays: days,
        totalIncidents,
        openIncidents,
        closedIncidents,
        criticalIncidents,
        totalPlaybookRuns: totalRuns,
        successfulPlaybookRuns: successfulRuns,
        automationSuccessRate: automationRate,
        avgResolutionHours
    };
};

export const getIncidentsOverTime = async (days = 30) => {
    const since = new Date(Date.now() - days * MS_PER_DAY);

    return Incident.aggregate([
        { $match: { createdAt: { $gte: since } } },
        {
            $group: {
                _id: {
                    date: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                    severity: "$severity"
                },
                count: { $sum: 1 }
            }
        },
        { $sort: { "_id.date": 1 } }
    ]);
};

export const getTopPlaybooks = async (limit = 10) => {
    return PlaybookRun.aggregate([
        {
            $group: {
                _id: "$playbookId",
                runs: { $sum: 1 },
                completed: {
                    $sum: { $cond: [{ $eq: ["$status", playbookRunStatus.COMPLETED] }, 1, 0] }
                },
                failed: {
                    $sum: { $cond: [{ $eq: ["$status", playbookRunStatus.FAILED] }, 1, 0] }
                }
            }
        },
        { $sort: { runs: -1 } },
        { $limit: limit },
        {
            $lookup: {
                from: "playbooks",
                localField: "_id",
                foreignField: "_id",
                as: "playbook"
            }
        },
        { $unwind: { path: "$playbook", preserveNullAndEmptyArrays: true } },
        {
            $project: {
                playbookId: "$_id",
                name: "$playbook.name",
                runs: 1,
                completed: 1,
                failed: 1,
                successRate: {
                    $cond: [
                        { $eq: ["$runs", 0] },
                        0,
                        { $multiply: [{ $divide: ["$completed", "$runs"] }, 100] }
                    ]
                }
            }
        }
    ]);
};

export const getAnalystPerformance = async (days = 30) => {
    const since = new Date(Date.now() - days * MS_PER_DAY);

    const [assigned, closed, runs] = await Promise.all([
        Incident.aggregate([
            { $match: { assignedTo: { $exists: true }, createdAt: { $gte: since } } },
            { $group: { _id: "$assignedTo", assigned: { $sum: 1 } } }
        ]),
        Incident.aggregate([
            {
                $match: {
                    assignedTo: { $exists: true },
                    closedAt: { $gte: since }
                }
            },
            { $group: { _id: "$assignedTo", closed: { $sum: 1 } } }
        ]),
        PlaybookRun.aggregate([
            { $match: { startedBy: { $exists: true }, createdAt: { $gte: since } } },
            { $group: { _id: "$startedBy", playbookRuns: { $sum: 1 } } }
        ])
    ]);

    const analystIds = [...new Set([
        ...assigned.map((a) => String(a._id)),
        ...closed.map((c) => String(c._id)),
        ...runs.map((r) => String(r._id))
    ])];

    const users = await User.find({ _id: { $in: analystIds } }).select("name email role");
    const userMap = Object.fromEntries(users.map((u) => [String(u._id), u]));

    return analystIds.map((id) => {
        const a = assigned.find((x) => String(x._id) === id);
        const c = closed.find((x) => String(x._id) === id);
        const r = runs.find((x) => String(x._id) === id);
        return {
            analyst: userMap[id] || { _id: id },
            assigned: a?.assigned || 0,
            closed: c?.closed || 0,
            playbookRuns: r?.playbookRuns || 0
        };
    }).sort((a, b) => b.closed - a.closed);
};

export const getIncidentTypes = async () => {
    return Incident.aggregate([
        {
            $group: {
                _id: { type: { $ifNull: ["$incidentType", "unspecified"] }, severity: "$severity" },
                count: { $sum: 1 }
            }
        },
        { $sort: { count: -1 } }
    ]);
};

export const getAutomationRoi = async (days = 30) => {
    const since = new Date(Date.now() - days * MS_PER_DAY);
    const manualMinutesPerIncident = 45;
    const automatedMinutesPerRun = 5;

    const [incidents, runs, integrations] = await Promise.all([
        Incident.countDocuments({ createdAt: { $gte: since } }),
        PlaybookRun.countDocuments({ status: playbookRunStatus.COMPLETED, createdAt: { $gte: since } }),
        IntegrationAction.countDocuments({
            status: integrationActionStatus.SUCCESS,
            executedAt: { $gte: since }
        })
    ]);

    const manualHours = Number(((incidents * manualMinutesPerIncident) / 60).toFixed(2));
    const automatedHours = Number(((runs * automatedMinutesPerRun) / 60).toFixed(2));
    const hoursSaved = Number(Math.max(0, manualHours - automatedHours).toFixed(2));

    return {
        periodDays: days,
        incidentsHandled: incidents,
        automatedRuns: runs,
        successfulIntegrations: integrations,
        estimatedManualHours: manualHours,
        estimatedAutomatedHours: automatedHours,
        estimatedHoursSaved: hoursSaved,
        roiPercent: manualHours ? Number(((hoursSaved / manualHours) * 100).toFixed(2)) : 0
    };
};

export const exportAnalytics = async (user, { format = "json", snapshotType = "full", days = 30 } = {}) => {
    const job = await analyticsQueue.add("exportSoarAnalytics", {
        userId: user._id,
        format,
        snapshotType,
        days
    }, { attempts: 2 });

    return { queued: true, jobId: job.id, format, snapshotType };
};

export const generateAnalyticsSnapshot = async (snapshotType = "full", period = "30d") => {
    const days = parseInt(period, 10) || 30;

    const [kpis, incidentsOverTime, topPlaybooks, analystPerformance, incidentTypes, automationRoi] =
        await Promise.all([
            getKpis(days),
            getIncidentsOverTime(days),
            getTopPlaybooks(),
            getAnalystPerformance(days),
            getIncidentTypes(),
            getAutomationRoi(days)
        ]);

    const data = {
        kpis,
        incidentsOverTime,
        topPlaybooks,
        analystPerformance,
        incidentTypes,
        automationRoi,
        generatedAt: new Date()
    };

    const snapshot = await AnalyticsSnapshot.create({
        snapshotType,
        period,
        data,
        generatedAt: new Date()
    });

    return snapshot;
};

export const listAnalyticsSnapshots = async (query = {}) => {
    const { parsePagination } = await import("../../../utils/pagination.js");
    const { page, limit, skip, sort } = parsePagination(query);
    const filter = {};
    if (query.snapshotType) filter.snapshotType = query.snapshotType;

    const [data, total] = await Promise.all([
        AnalyticsSnapshot.find(filter).sort(sort).skip(skip).limit(limit),
        AnalyticsSnapshot.countDocuments(filter)
    ]);

    return { data, page, limit, total };
};

export const getAnalyticsReport = async (days = 30) => {
    const [kpis, incidentsOverTime, topPlaybooks, analystPerformance, incidentTypes, automationRoi] =
        await Promise.all([
            getKpis(days),
            getIncidentsOverTime(days),
            getTopPlaybooks(),
            getAnalystPerformance(days),
            getIncidentTypes(),
            getAutomationRoi(days)
        ]);

    return {
        kpis,
        incidentsOverTime,
        topPlaybooks,
        analystPerformance,
        incidentTypes,
        automationRoi
    };
};
