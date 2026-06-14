import dotenv from "dotenv";
import { alertQueue } from "../utils/queue.js";
import { connectDB } from "../../database/connection.js";
import { logger } from "../utils/logger.js";
import { SoarAlert, Incident, User } from "../../database/index.js";
import { incidentStatus, sourceModule } from "../utils/constant/enums.js";
import { emitAlert } from "../utils/socket.js";

dotenv.config({ path: "./config/.env" });
await connectDB();

const PROCESS_OPTS = { concurrency: 2 };

const resolveSystemUser = async () => {
    const admin = await User.findOne({ role: "admin" });
    if (admin) return admin;
    return User.findOne().sort({ createdAt: 1 });
};

alertQueue.process("processSoarAlert", PROCESS_OPTS.concurrency, async (job) => {
    const { alertId, createIncident = true } = job.data;

    const alert = await SoarAlert.findById(alertId);
    if (!alert) throw new Error(`SOAR alert not found: ${alertId}`);

    if (alert.incidentId) {
        return { alertId, incidentId: alert.incidentId, alreadyProcessed: true };
    }

    if (!createIncident) {
        alert.processedAt = new Date();
        await alert.save();
        return { alertId, incidentCreated: false };
    }

    const raw = alert.rawPayload || {};
    const systemUser = await resolveSystemUser();
    if (!systemUser) throw new Error("No system user available to create incident from alert");

    const incident = await Incident.create({
        title: alert.title,
        description: alert.description,
        severity: alert.severity,
        status: incidentStatus.NEW,
        sourceIP: raw.sourceIP || raw.sourceIp,
        affectedHost: raw.affectedHost || raw.hostname,
        incidentType: alert.source,
        tags: [alert.source, sourceModule.SOAR, "webhook"],
        createdBy: systemUser._id
    });

    alert.incidentId = incident._id;
    alert.processedAt = new Date();
    await alert.save();

    emitAlert("soc_analyst", "incident:created", {
        incidentId: incident._id,
        title: incident.title,
        severity: incident.severity,
        source: "alert_worker",
        alertId: alert._id
    });

    logger.info(`SOAR alert ${alertId} linked to incident ${incident._id}`);
    return { alertId, incidentId: incident._id, incidentCreated: true };
});

logger.info("Alert worker started");
