/**
 * SOAR seed data — run with: npm run seed:soar
 * Requires MONGO_URI in environment.
 */
import dotenv from "dotenv";
import { connectDB } from "../connection.js";
import {
    User, Incident, Playbook, Connector, WebhookSource, SoarAlert
} from "../index.js";
import {
    incidentSeverity, incidentStatus, connectorType, alertSource, playbookTrigger
} from "../../src/utils/constant/enums.js";

dotenv.config({ path: "config/.env" });

const seed = async () => {
    await connectDB();

    let admin = await User.findOne({ role: "admin" });
    if (!admin) {
        admin = await User.create({
            name: "SOAR Admin",
            email: "soar-admin@lumisec.io",
            password: "$2b$12$placeholder",
            role: "admin",
            department: "SOC"
        });
    }

    const incident = await Incident.create({
        title: "Suspicious outbound traffic",
        description: "Beaconing detected to known C2 infrastructure",
        severity: incidentSeverity.HIGH,
        status: incidentStatus.OPEN,
        sourceIP: "10.0.5.42",
        affectedHost: "workstation-07",
        incidentType: "network",
        tags: ["c2", "beaconing"],
        createdBy: admin._id
    });

    const playbook = await Playbook.create({
        name: "Block and Notify",
        description: "Block malicious IP and notify SOC",
        triggerType: playbookTrigger.MANUAL,
        actions: [
            { id: "step-0", type: "block_ip", order: 0, params: {} },
            { id: "step-1", type: "notify", order: 1, params: { to: "soc@lumisec.io" } }
        ],
        createdBy: admin._id,
        isActive: true
    });

    const connector = await Connector.create({
        name: "FortiGate Production",
        type: connectorType.FIREWALL,
        config: { host: process.env.FORTIGATE_HOST || "fortigate.local" },
        createdBy: admin._id,
        isActive: true
    });

    const webhookSource = await WebhookSource.create({
        name: "Custom SIEM Feed",
        source: alertSource.CUSTOM,
        secret: process.env.SOAR_WEBHOOK_SECRET || "dev-webhook-secret",
        createdBy: admin._id,
        isActive: true
    });

    const alert = await SoarAlert.create({
        externalId: "seed-alert-001",
        source: alertSource.CUSTOM,
        title: "Custom webhook test alert",
        description: "Seed alert for SOAR module verification",
        severity: incidentSeverity.MEDIUM,
        rawPayload: {
            externalId: "seed-alert-001",
            title: "Custom webhook test alert",
            severity: "medium",
            sourceIP: "203.0.113.10"
        },
        incidentId: incident._id,
        processedAt: new Date()
    });

    console.log("SOAR seed complete:", {
        admin: admin._id.toString(),
        incident: incident._id.toString(),
        playbook: playbook._id.toString(),
        connector: connector._id.toString(),
        webhookSource: webhookSource._id.toString(),
        alert: alert._id.toString()
    });

    process.exit(0);
};

seed().catch((err) => {
    console.error(err);
    process.exit(1);
});
