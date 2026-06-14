import test from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { clearTestDb, closeTestEnv, initTestEnv } from "./helpers/testApp.js";
import { Incident, Playbook, PlaybookRun, User } from "../database/index.js";
import { generateToken } from "../src/utils/token.js";
import { incidentStatus, connectorType, artifactType } from "../src/utils/constant/enums.js";

let app;

const stubQueue = (queue) => {
    queue.add = async (jobName, data = {}, opts = {}) => ({
        id: `test-job-${Date.now()}`,
        name: jobName,
        data,
        opts
    });
};

const createUserAndToken = async ({ email, role }) => {
    const user = await User.create({
        name: role,
        email,
        password: "hashed-password",
        role,
        department: "SOC"
    });

    return { user, token: generateToken({ _id: user._id, role: user.role }) };
};

test.before(async () => {
    process.env.NODE_ENV = "test";
    await initTestEnv();

    const { buildTestApp } = await import("./helpers/testApp.js");
    const queues = await import("../src/utils/queue.js");

    stubQueue(queues.soarQueue);
    stubQueue(queues.enrichmentQueue);
    stubQueue(queues.alertQueue);
    stubQueue(queues.soarNotificationQueue);
    stubQueue(queues.analyticsQueue);
    stubQueue(queues.soarIntegrationQueue);

    app = buildTestApp();
});

test.after(async () => {
    await closeTestEnv();
});

test.beforeEach(async () => {
    await clearTestDb();
});

test("POST /api/soar/incidents creates an incident", async () => {
    const { token } = await createUserAndToken({ email: "analyst@lumisec.io", role: "soc_analyst" });

    const response = await request(app)
        .post("/api/soar/incidents")
        .set("Authorization", `Bearer ${token}`)
        .send({
            title: "Suspicious login",
            severity: "high",
            description: "Brute force activity detected"
        });

    assert.equal(response.status, 201);
    assert.equal(response.body.success, true);
    assert.equal(response.body.data.title, "Suspicious login");
});

test("GET /api/soar/incidents returns incidents for allowed roles", async () => {
    const { user, token } = await createUserAndToken({ email: "manager@lumisec.io", role: "soc_manager" });

    await Incident.create({
        title: "VPN alert",
        severity: "medium",
        createdBy: user._id
    });

    const response = await request(app)
        .get("/api/soar/incidents")
        .set("Authorization", `Bearer ${token}`);

    assert.equal(response.status, 200);
    assert.equal(response.body.success, true);
    assert.equal(response.body.data.length, 1);
});

test("GET /api/soar/incidents/:id returns a single incident", async () => {
    const { user, token } = await createUserAndToken({ email: "analyst-get@lumisec.io", role: "soc_analyst" });

    const incident = await Incident.create({
        title: "Malware detected",
        severity: "critical",
        createdBy: user._id
    });

    const response = await request(app)
        .get(`/api/soar/incidents/${incident._id}`)
        .set("Authorization", `Bearer ${token}`);

    assert.equal(response.status, 200);
    assert.equal(response.body.data._id, incident._id.toString());
    assert.equal(response.body.data.title, "Malware detected");
});

test("PATCH /api/soar/incidents/:id updates an incident", async () => {
    const { user, token } = await createUserAndToken({ email: "analyst-patch@lumisec.io", role: "soc_analyst" });

    const incident = await Incident.create({
        title: "Phishing email",
        severity: "medium",
        createdBy: user._id
    });

    const response = await request(app)
        .patch(`/api/soar/incidents/${incident._id}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ status: incidentStatus.IN_PROGRESS, description: "Under investigation" });

    assert.equal(response.status, 200);
    assert.equal(response.body.data.status, incidentStatus.IN_PROGRESS);
    assert.equal(response.body.data.description, "Under investigation");
});

test("DELETE /api/soar/incidents/:id soft deletes an incident", async () => {
    const { user, token } = await createUserAndToken({ email: "admin-del@lumisec.io", role: "admin" });

    const incident = await Incident.create({
        title: "False alarm",
        severity: "low",
        createdBy: user._id
    });

    const response = await request(app)
        .delete(`/api/soar/incidents/${incident._id}`)
        .set("Authorization", `Bearer ${token}`);

    assert.equal(response.status, 200);
    assert.ok(response.body.data.deletedAt);

    const hidden = await Incident.findById(incident._id);
    assert.equal(hidden, null);
});

test("PATCH /api/soar/incidents/:incidentId/close closes an open incident", async () => {
    const { user, token } = await createUserAndToken({ email: "analyst2@lumisec.io", role: "soc_analyst" });

    const incident = await Incident.create({
        title: "Endpoint malware",
        severity: "critical",
        createdBy: user._id
    });

    const response = await request(app)
        .patch(`/api/soar/incidents/${incident._id}/close`)
        .set("Authorization", `Bearer ${token}`)
        .send({ notes: "Contained", isFalsePositive: false });

    assert.equal(response.status, 200);
    assert.equal(response.body.data.status, incidentStatus.CLOSED);
});

test("POST /api/soar/playbooks creates a playbook", async () => {
    const { token } = await createUserAndToken({ email: "manager-pb@lumisec.io", role: "soc_manager" });

    const response = await request(app)
        .post("/api/soar/playbooks")
        .set("Authorization", `Bearer ${token}`)
        .send({
            name: "Isolate Host",
            description: "Isolate compromised endpoint",
            actions: [
                { type: "isolate_host", order: 0, params: { os: "linux" } }
            ]
        });

    assert.equal(response.status, 201);
    assert.equal(response.body.data.name, "Isolate Host");
    assert.equal(response.body.data.actions.length, 1);
});

test("POST /api/soar/incidents/:id/playbooks/run executes a playbook run", async () => {
    const { user, token } = await createUserAndToken({ email: "analyst-run@lumisec.io", role: "soc_analyst" });

    const incident = await Incident.create({
        title: "C2 traffic",
        severity: "high",
        sourceIP: "198.51.100.10",
        createdBy: user._id
    });

    const playbook = await Playbook.create({
        name: "Block IP",
        actions: [{ id: "step-0", type: "block_ip", order: 0 }],
        createdBy: user._id,
        isActive: true
    });

    const response = await request(app)
        .post(`/api/soar/incidents/${incident._id}/playbooks/run`)
        .set("Authorization", `Bearer ${token}`)
        .send({ playbookId: playbook._id.toString() });

    assert.equal(response.status, 202);
    assert.equal(response.body.data.queued, true);
    assert.ok(response.body.data.run);

    const run = await PlaybookRun.findById(response.body.data.run._id);
    assert.ok(run);
    assert.equal(run.incidentId.toString(), incident._id.toString());
});

test("POST /api/soar/incidents/:id/artifacts adds an artifact", async () => {
    const { user, token } = await createUserAndToken({ email: "analyst-art@lumisec.io", role: "soc_analyst" });

    const incident = await Incident.create({
        title: "IOC collection",
        severity: "medium",
        createdBy: user._id
    });

    const response = await request(app)
        .post(`/api/soar/incidents/${incident._id}/artifacts`)
        .set("Authorization", `Bearer ${token}`)
        .send({
            type: artifactType.IP,
            value: "203.0.113.55",
            label: "C2 server"
        });

    assert.equal(response.status, 201);
    assert.equal(response.body.data.value, "203.0.113.55");
    assert.equal(response.body.data.type, artifactType.IP);
});

test("POST /api/soar/webhooks/custom ingests a custom alert", async () => {
    const { token } = await createUserAndToken({ email: "integration@lumisec.io", role: "integration_admin" });

    const response = await request(app)
        .post("/api/soar/webhooks/custom")
        .set("Authorization", `Bearer ${token}`)
        .send({
            externalId: "custom-alert-001",
            title: "Custom SIEM alert",
            description: "Suspicious PowerShell execution",
            severity: "high",
            sourceIP: "10.10.10.5"
        });

    assert.equal(response.status, 202);
    assert.equal(response.body.data.alert.title, "Custom SIEM alert");
    assert.equal(response.body.data.queued, true);
});

test("GET /api/soar/dashboard/overview returns dashboard metrics", async () => {
    const { user, token } = await createUserAndToken({ email: "viewer@lumisec.io", role: "read_only" });

    await Incident.create({
        title: "Open case",
        severity: "high",
        status: incidentStatus.OPEN,
        createdBy: user._id
    });

    const response = await request(app)
        .get("/api/soar/dashboard/overview")
        .set("Authorization", `Bearer ${token}`);

    assert.equal(response.status, 200);
    assert.ok(typeof response.body.data.totalIncidents === "number");
    assert.ok(typeof response.body.data.openIncidents === "number");
});

test("POST /api/soar/connectors creates a connector", async () => {
    const { token } = await createUserAndToken({ email: "conn@lumisec.io", role: "integration_admin" });

    const response = await request(app)
        .post("/api/soar/connectors")
        .set("Authorization", `Bearer ${token}`)
        .send({
            name: "ELK SIEM",
            type: connectorType.SIEM,
            config: { url: "http://localhost:9200" }
        });

    assert.equal(response.status, 201);
    assert.equal(response.body.data.name, "ELK SIEM");
    assert.equal(response.body.data.type, connectorType.SIEM);
});

test("POST /api/soar/incidents is blocked for read_only role", async () => {
    const { token } = await createUserAndToken({ email: "readonly@lumisec.io", role: "read_only" });

    const response = await request(app)
        .post("/api/soar/incidents")
        .set("Authorization", `Bearer ${token}`)
        .send({
            title: "Should fail",
            severity: "low"
        });

    assert.equal(response.status, 403);
});
