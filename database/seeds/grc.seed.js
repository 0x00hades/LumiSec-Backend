/**
 * GRC seed data example — run with: node database/seeds/grc.seed.js
 * Requires MONGO_URI in environment and an existing admin user.
 */
import dotenv from "dotenv";
import { connectDB } from "../connection.js";
import {
    User, Finding, Risk, RemediationTask, ComplianceControl,
    AuditReport, SiemAlert
} from "../index.js";
import {
    sourceModule, severity, riskLevel, findingStatus, riskStatus,
    taskStatus, taskPriority, complianceFramework, controlStatus
} from "../../src/utils/constant/enums.js";

dotenv.config({ path: "config/.env" });

const seed = async () => {
    await connectDB();

    let admin = await User.findOne({ role: "admin" });
    if (!admin) {
        admin = await User.create({
            name: "GRC Admin",
            email: "grc-admin@lumisec.io",
            password: "$2b$12$placeholder",
            role: "admin",
            department: "GRC"
        });
    }

    const finding = await Finding.create({
        title: "Unencrypted S3 bucket exposed",
        description: "Public read access detected on production bucket",
        severity: severity.HIGH,
        riskRating: riskLevel.HIGH,
        asset: "s3://prod-data",
        sourceModule: sourceModule.NETWORK,
        sourceId: "net-scan-001",
        status: findingStatus.OPEN,
        createdBy: admin._id,
        tags: ["cloud", "data-exposure"]
    });

    const risk = await Risk.create({
        findingId: finding._id,
        title: "Data breach via exposed bucket",
        description: "Customer PII may be accessible publicly",
        likelihood: 4,
        impact: 5,
        owner: admin._id,
        status: riskStatus.OPEN
    });

    const task = await RemediationTask.create({
        findingId: finding._id,
        title: "Restrict S3 bucket ACL",
        description: "Apply private ACL and enable bucket encryption",
        assignedTo: admin._id,
        assignedBy: admin._id,
        priority: taskPriority.HIGH,
        status: taskStatus.OPEN,
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    });

    const controls = await ComplianceControl.insertMany([
        {
            framework: complianceFramework.ISO27001,
            controlId: "A.8.2.3",
            title: "Handling of removable media",
            description: "Media handling procedures",
            status: controlStatus.PARTIALLY_COMPLIANT,
            linkedFindings: [finding._id]
        },
        {
            framework: complianceFramework.NIST,
            controlId: "AC-3",
            title: "Access Enforcement",
            description: "Enforce approved authorizations",
            status: controlStatus.NON_COMPLIANT,
            linkedFindings: [finding._id]
        }
    ]);

    const report = await AuditReport.create({
        title: "Q2 2026 Cloud Security Audit",
        framework: complianceFramework.SOC2,
        scope: "AWS production environment",
        findings: [finding._id],
        generatedBy: admin._id,
        summary: "Two critical cloud misconfigurations identified"
    });

    await SiemAlert.create({
        alertId: "siem-alert-seed-001",
        ruleName: "Suspicious S3 Access",
        severity: severity.HIGH,
        sourceIp: "10.0.1.50",
        destinationIp: "52.1.2.3",
        indexName: "aws-cloudtrail-*",
        findingId: finding._id
    });

    console.log("GRC seed complete:", {
        finding: finding._id.toString(),
        risk: risk._id.toString(),
        task: task._id.toString(),
        controls: controls.map((c) => c._id.toString()),
        report: report._id.toString()
    });

    process.exit(0);
};

seed().catch((err) => {
    console.error(err);
    process.exit(1);
});
