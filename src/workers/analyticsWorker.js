import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { analyticsQueue } from "../utils/queue.js";
import { connectDB } from "../../database/connection.js";
import { logger } from "../utils/logger.js";
import * as analyticsService from "../modules/soar/services/analytics.service.js";

dotenv.config({ path: "./config/.env" });
await connectDB();

const PROCESS_OPTS = { concurrency: 1 };
const exportDir = process.env.SOAR_ANALYTICS_DIR || "uploads/soar-analytics";
fs.mkdirSync(exportDir, { recursive: true });

analyticsQueue.process("generateSnapshot", PROCESS_OPTS.concurrency, async (job) => {
    const { snapshotType = "full", period = "30d" } = job.data;

    logger.info(`Generating SOAR analytics snapshot (${snapshotType}, ${period})`);
    const snapshot = await analyticsService.generateAnalyticsSnapshot(snapshotType, period);
    return { snapshotId: snapshot._id, snapshotType, period };
});

analyticsQueue.process("exportSoarAnalytics", PROCESS_OPTS.concurrency, async (job) => {
    const { userId, format = "json", snapshotType = "full", days = 30 } = job.data;
    const period = `${days}d`;

    logger.info(`Exporting SOAR analytics for user ${userId} (${format})`);
    const snapshot = await analyticsService.generateAnalyticsSnapshot(snapshotType, period);
    const filename = `soar-analytics-${snapshot._id}-${Date.now()}.${format === "csv" ? "csv" : "json"}`;
    const filePath = path.join(exportDir, filename);

    if (format === "csv") {
        const rows = [
            "metric,value",
            `totalIncidents,${snapshot.data.kpis.totalIncidents}`,
            `openIncidents,${snapshot.data.kpis.openIncidents}`,
            `automationSuccessRate,${snapshot.data.kpis.automationSuccessRate}`
        ];
        fs.writeFileSync(filePath, rows.join("\n"));
    } else {
        fs.writeFileSync(filePath, JSON.stringify(snapshot.data, null, 2));
    }

    return { snapshotId: snapshot._id, filePath, format, userId };
});

logger.info("Analytics worker started");
