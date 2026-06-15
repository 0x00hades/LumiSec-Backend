import test from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { buildTestApp, clearTestDb, closeTestEnv, initTestEnv } from "./helpers/testApp.js";
import { Finding, Risk, User } from "../database/index.js";
import { generateToken } from "../src/utils/token.js";

const app = buildTestApp();
const INTERNAL_KEY = "test-internal-key";

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
    process.env.INTERNAL_API_KEY = INTERNAL_KEY;
    await initTestEnv();
});

test.after(async () => {
    await closeTestEnv();
});

test.beforeEach(async () => {
    await clearTestDb();
});

test("POST /api/grc/integrations/siem/alerts accepts internal API key", async () => {
    const response = await request(app)
        .post("/api/grc/integrations/siem/alerts")
        .set("X-Internal-Api-Key", INTERNAL_KEY)
        .send({
            alertId: "siem-alert-001",
            ruleName: "Brute Force Detected",
            severity: "high",
            sourceIp: "10.0.0.15",
            indexName: "winlogbeat-*"
        });

    assert.equal(response.status, 201);
    assert.equal(response.body.data.alert.alertId, "siem-alert-001");
    assert.ok(response.body.data.finding._id);
});

test("POST /api/grc/integrations/network/findings is idempotent by sourceId", async () => {
    const { token } = await createUserAndToken({ email: "grc@lumisec.io", role: "grc_manager" });

    const payload = {
        title: "Telnet exposed",
        description: "Telnet service detected on asset",
        severity: "high",
        sourceId: "scan-001:telnet:10.0.0.5",
        asset: "10.0.0.5"
    };

    const first = await request(app)
        .post("/api/grc/integrations/network/findings")
        .set("Authorization", `Bearer ${token}`)
        .send(payload);

    const second = await request(app)
        .post("/api/grc/integrations/network/findings")
        .set("Authorization", `Bearer ${token}`)
        .send(payload);

    assert.equal(first.status, 201);
    assert.equal(second.status, 201);
    assert.equal(first.body.data._id, second.body.data._id);
    assert.equal(await Finding.countDocuments(), 1);
});

test("POST /api/grc/integrations/phishing/risk creates finding and risk", async () => {
    const { token } = await createUserAndToken({ email: "grc@lumisec.io", role: "grc_manager" });

    const response = await request(app)
        .post("/api/grc/integrations/phishing/risk")
        .set("Authorization", `Bearer ${token}`)
        .send({
            title: "Credential submitted",
            description: "User submitted credentials in phishing simulation",
            eventType: "submit",
            sourceId: "phish-event-001"
        });

    assert.equal(response.status, 201);
    assert.ok(response.body.data.risk._id);
    assert.ok(response.body.data.finding._id);
    assert.equal(await Risk.countDocuments(), 1);
});

test("POST /api/luminet/integrations/grc/finding creates GRC finding", async () => {
    const { token } = await createUserAndToken({ email: "net@lumisec.io", role: "detection_engineer" });

    const response = await request(app)
        .post("/api/luminet/integrations/grc/finding")
        .set("Authorization", `Bearer ${token}`)
        .send({
            title: "Critical SMB exposure",
            description: "SMB exposed on management VLAN",
            severity: "critical",
            sourceId: "scan-99:smb:10.0.0.8",
            asset: "10.0.0.8"
        });

    assert.equal(response.status, 201);
    assert.equal(response.body.data.sourceModule, "network");
});

test("POST /api/uctc/integrations/grc/gap creates detection-gap finding", async () => {
    const { token } = await createUserAndToken({ email: "uctc@lumisec.io", role: "detection_engineer" });

    const response = await request(app)
        .post("/api/uctc/integrations/grc/gap")
        .set("Authorization", `Bearer ${token}`)
        .send({
            title: "Missing Sysmon process creation rule",
            description: "No deployed rule covers process creation on CLIENT01",
            severity: "medium",
            sourceId: "gap-sysmon-001",
            asset: "10.0.0.21"
        });

    assert.equal(response.status, 201);
    assert.ok(response.body.data.tags.includes("detection-gap"));
});

test("POST /api/soar/integrations/network/block-ip aliases firewall route", async () => {
    const { token } = await createUserAndToken({ email: "soar@lumisec.io", role: "integration_admin" });

    const response = await request(app)
        .post("/api/soar/integrations/network/block-ip")
        .set("Authorization", `Bearer ${token}`)
        .send({ ip: "203.0.113.50", comment: "SOAR test block" });

    assert.notEqual(response.status, 404);
});
