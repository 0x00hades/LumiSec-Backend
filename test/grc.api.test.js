import test from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { buildTestApp, clearTestDb, closeTestEnv, initTestEnv } from "./helpers/testApp.js";
import { Finding, Risk, RemediationTask, User } from "../database/index.js";
import { generateToken } from "../src/utils/token.js";
import { findingStatus, severity, riskLevel, retestResult } from "../src/utils/constant/enums.js";

const app = buildTestApp();

const createUserAndToken = async ({ email, role }) => {
    const user = await User.create({
        name: role,
        email,
        password: "hashed-password",
        role,
        department: "GRC"
    });

    return { user, token: generateToken({ _id: user._id, role: user.role }) };
};

test.before(async () => {
    await initTestEnv();
});

test.after(async () => {
    await closeTestEnv();
});

test.beforeEach(async () => {
    await clearTestDb();
});

test("POST /api/grc/findings creates a finding", async () => {
    const { token } = await createUserAndToken({ email: "auditor@lumisec.io", role: "auditor" });

    const response = await request(app)
        .post("/api/grc/findings")
        .set("Authorization", `Bearer ${token}`)
        .send({
            title: "Missing MFA",
            description: "Critical accounts are missing MFA",
            severity: severity.HIGH,
            riskRating: riskLevel.HIGH
        });

    assert.equal(response.status, 201);
    assert.equal(response.body.success, true);
    assert.equal(response.body.data.title, "Missing MFA");
});

test("GET /api/grc/findings returns findings with pagination", async () => {
    const { user, token } = await createUserAndToken({ email: "manager@lumisec.io", role: "compliance_manager" });

    await Finding.create({
        title: "Password policy gap",
        description: "Weak password length",
        severity: severity.MEDIUM,
        riskRating: riskLevel.MEDIUM,
        createdBy: user._id
    });

    const response = await request(app)
        .get("/api/grc/findings")
        .set("Authorization", `Bearer ${token}`);

    assert.equal(response.status, 200);
    assert.equal(response.body.success, true);
    assert.equal(response.body.data.length, 1);
    assert.equal(response.body.pagination.total, 1);
});

test("PATCH /api/grc/findings/:id/close closes a finding", async () => {
    const { user, token } = await createUserAndToken({ email: "auditor2@lumisec.io", role: "auditor" });

    const finding = await Finding.create({
        title: "Open port",
        description: "Unnecessary port open",
        severity: severity.HIGH,
        riskRating: riskLevel.HIGH,
        status: findingStatus.READY_FOR_RETEST,
        createdBy: user._id
    });

    const response = await request(app)
        .patch(`/api/grc/findings/${finding._id}/close`)
        .set("Authorization", `Bearer ${token}`);

    assert.equal(response.status, 200);
    assert.equal(response.body.success, true);
    assert.equal(response.body.data.status, findingStatus.CLOSED);
});

test("POST /api/grc/risks creates risk with auto-calculated score", async () => {
    const { token } = await createUserAndToken({ email: "grc@lumisec.io", role: "grc_manager" });

    const response = await request(app)
        .post("/api/grc/risks")
        .set("Authorization", `Bearer ${token}`)
        .send({
            title: "Data exfiltration risk",
            description: "Unencrypted data in transit",
            likelihood: 4,
            impact: 5
        });

    assert.equal(response.status, 201);
    assert.equal(response.body.data.score, 20);
    assert.equal(response.body.data.riskLevel, riskLevel.CRITICAL);
});

test("POST /api/grc/tasks creates remediation task", async () => {
    const { user: auditor, token: auditorToken } = await createUserAndToken({ email: "auditor3@lumisec.io", role: "auditor" });
    const { user: assignee } = await createUserAndToken({ email: "assignee@lumisec.io", role: "assignee" });
    const { token: itToken } = await createUserAndToken({ email: "it@lumisec.io", role: "it_manager" });

    const finding = await Finding.create({
        title: "Weak TLS",
        description: "TLS 1.0 enabled",
        severity: severity.MEDIUM,
        riskRating: riskLevel.MEDIUM,
        createdBy: auditor._id
    });

    const response = await request(app)
        .post("/api/grc/tasks")
        .set("Authorization", `Bearer ${itToken}`)
        .send({
            findingId: finding._id.toString(),
            title: "Disable TLS 1.0",
            description: "Upgrade to TLS 1.2+",
            assignedTo: assignee._id.toString()
        });

    assert.equal(response.status, 201);
    assert.equal(response.body.data.title, "Disable TLS 1.0");

    const updatedFinding = await Finding.findById(finding._id);
    assert.equal(updatedFinding.status, findingStatus.IN_PROGRESS);
});

test("POST /api/grc/findings/:id/retest with pass closes finding", async () => {
    const { user, token } = await createUserAndToken({ email: "auditor4@lumisec.io", role: "auditor" });

    const finding = await Finding.create({
        title: "Retest finding",
        description: "Needs retest",
        severity: severity.LOW,
        riskRating: riskLevel.LOW,
        status: findingStatus.READY_FOR_RETEST,
        createdBy: user._id
    });

    const response = await request(app)
        .post(`/api/grc/findings/${finding._id}/retest`)
        .set("Authorization", `Bearer ${token}`)
        .send({ result: retestResult.PASS, notes: "Fix verified" });

    assert.equal(response.status, 201);
    assert.equal(response.body.data.finding.status, findingStatus.CLOSED);
});

test("GET /api/grc/dashboard/overview returns statistics", async () => {
    const { user, token } = await createUserAndToken({ email: "dash@lumisec.io", role: "grc_manager" });

    await Finding.create({
        title: "Dashboard finding",
        description: "Test",
        severity: severity.LOW,
        riskRating: riskLevel.LOW,
        createdBy: user._id
    });

    await Risk.create({
        title: "Dashboard risk",
        description: "Test risk",
        likelihood: 2,
        impact: 3,
        owner: user._id
    });

    const response = await request(app)
        .get("/api/grc/dashboard/overview")
        .set("Authorization", `Bearer ${token}`);

    assert.equal(response.status, 200);
    assert.equal(response.body.data.openFindings >= 1, true);
});

test("POST /api/grc/integrations/siem/alerts ingests alert and creates finding", async () => {
    const { token } = await createUserAndToken({ email: "soc@lumisec.io", role: "soc_analyst" });

    const response = await request(app)
        .post("/api/grc/integrations/siem/alerts")
        .set("Authorization", `Bearer ${token}`)
        .send({
            alertId: "siem-test-001",
            ruleName: "Failed Login Burst",
            severity: severity.HIGH,
            sourceIp: "10.0.0.1",
            indexName: "auth-logs-*"
        });

    assert.equal(response.status, 201);
    assert.equal(response.body.data.finding.title.includes("Failed Login Burst"), true);
    assert.equal(response.body.data.alert.alertId, "siem-test-001");
});
