import test from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { buildTestApp, clearTestDb, closeTestEnv, initTestEnv } from "./helpers/testApp.js";
import { Campaign, EmailTemplate, User } from "../database/index.js";
import { generateToken } from "../src/utils/token.js";
import { campaignStatus } from "../src/utils/constant/enums.js";

const app = buildTestApp();

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
    await initTestEnv();
});

test.after(async () => {
    await closeTestEnv();
});

test.beforeEach(async () => {
    await clearTestDb();
});

test("POST /api/phishing/templates creates a template", async () => {
    const { token } = await createUserAndToken({ email: "manager@lumisec.io", role: "phishing_manager" });

    const response = await request(app)
        .post("/api/phishing/templates")
        .set("Authorization", `Bearer ${token}`)
        .send({
            name: "Security Alert",
            subject: "Action required",
            htmlBody: "<p>Please review</p>"
        });

    assert.equal(response.status, 201);
    assert.equal(response.body.data.name, "Security Alert");
});

test("POST /api/phishing/campaigns creates a campaign", async () => {
    const { user, token } = await createUserAndToken({ email: "operator@lumisec.io", role: "phishing_operator" });

    const template = await EmailTemplate.create({
        name: "Template",
        subject: "Security update",
        htmlBody: "<p>Hello</p>",
        createdBy: user._id
    });

    const response = await request(app)
        .post("/api/phishing/campaigns")
        .set("Authorization", `Bearer ${token}`)
        .send({
            name: "Quarterly awareness",
            templateId: template._id.toString()
        });

    assert.equal(response.status, 201);
    assert.equal(response.body.data.name, "Quarterly awareness");
});

test("GET /api/phishing/campaigns returns campaigns for allowed roles", async () => {
    const { user, token } = await createUserAndToken({ email: "analyst@lumisec.io", role: "soc_analyst" });

    const template = await EmailTemplate.create({
        name: "Template",
        subject: "Test",
        htmlBody: "<p>Test</p>",
        createdBy: user._id
    });

    await Campaign.create({
        name: "Phish test",
        templateId: template._id,
        createdBy: user._id
    });

    const response = await request(app)
        .get("/api/phishing/campaigns")
        .set("Authorization", `Bearer ${token}`);

    assert.equal(response.status, 200);
    assert.equal(response.body.data.length, 1);
});

test("GET /api/phishing/campaigns is blocked for unauthorized role", async () => {
    const { token } = await createUserAndToken({ email: "assignee@lumisec.io", role: "assignee" });

    const response = await request(app)
        .get("/api/phishing/campaigns")
        .set("Authorization", `Bearer ${token}`);

    assert.equal(response.status, 403);
});

test("POST /api/phishing/recipients/import imports CSV recipients", async () => {
    const { token } = await createUserAndToken({ email: "pm@lumisec.io", role: "phishing_manager" });

    const response = await request(app)
        .post("/api/phishing/recipients/import")
        .set("Authorization", `Bearer ${token}`)
        .send({
            csv: "name,email,department\nJohn Doe,john@lumisec.io,IT"
        });

    assert.equal(response.status, 201);
    assert.equal(response.body.data.imported, 1);
});

test("GET /api/phishing/dashboard/overview returns stats", async () => {
    const { token } = await createUserAndToken({ email: "admin@lumisec.io", role: "admin" });

    const response = await request(app)
        .get("/api/phishing/dashboard/overview")
        .set("Authorization", `Bearer ${token}`);

    assert.equal(response.status, 200);
    assert.ok(response.body.data.totalCampaigns >= 0);
});

test("POST /api/phishing/track/submit/:trackingId rejects password field", async () => {
    const { user, token } = await createUserAndToken({ email: "op@lumisec.io", role: "phishing_operator" });

    const template = await EmailTemplate.create({
        name: "T",
        subject: "S",
        htmlBody: "<p>x</p>",
        createdBy: user._id
    });

    const campaign = await Campaign.create({
        name: "C",
        templateId: template._id,
        createdBy: user._id,
        status: campaignStatus.RUNNING
    });

    const { Recipient } = await import("../database/index.js");
    const recipient = await Recipient.create({
        campaignId: campaign._id,
        email: "victim@lumisec.io",
        trackingId: "abc123trackingid01"
    });

    const response = await request(app)
        .post(`/api/phishing/track/submit/${recipient.trackingId}`)
        .send({ username: "victim", password: "secret123" });

    assert.equal(response.status, 422);
    assert.equal(token ? true : true, true);
});

test("GET /api/phishing/events lists tracking events", async () => {
    const { user, token } = await createUserAndToken({ email: "events@lumisec.io", role: "soc_analyst" });

    const template = await EmailTemplate.create({
        name: "T2",
        subject: "S",
        htmlBody: "<p>x</p>",
        createdBy: user._id
    });

    const campaign = await Campaign.create({
        name: "Event Campaign",
        templateId: template._id,
        createdBy: user._id,
        status: campaignStatus.RUNNING
    });

    const { Recipient, PhishingEvent } = await import("../database/index.js");
    const recipient = await Recipient.create({
        campaignId: campaign._id,
        email: "tracked@lumisec.io",
        trackingId: "trackid123456789"
    });

    await PhishingEvent.create({
        campaignId: campaign._id,
        recipientId: recipient._id,
        eventType: "email_opened",
        timestamp: new Date()
    });

    const response = await request(app)
        .get("/api/phishing/events")
        .set("Authorization", `Bearer ${token}`);

    assert.equal(response.status, 200);
    assert.equal(response.body.success, true);
    assert.ok(Array.isArray(response.body.data));
    assert.ok(response.body.data.length >= 1);
});
