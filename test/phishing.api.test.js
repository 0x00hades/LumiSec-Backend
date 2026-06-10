import test from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { buildTestApp, clearTestDb, closeTestEnv, initTestEnv } from "./helpers/testApp.js";
import { Campaign, User } from "../database/index.js";
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

test("POST /api/phishing creates a campaign", async () => {
    const { token } = await createUserAndToken({ email: "manager@lumisec.io", role: "soc_manager" });

    const response = await request(app)
        .post("/api/phishing")
        .set("Authorization", `Bearer ${token}`)
        .send({
            name: "Quarterly awareness",
            template: {
                subject: "Security update",
                senderName: "LumiSec",
                senderEmail: "security@lumisec.io",
                htmlBody: "<p>Hello</p>"
            }
        });

    assert.equal(response.status, 201);
    assert.equal(response.body.success, true);
    assert.equal(response.body.data.name, "Quarterly awareness");
});

test("GET /api/phishing returns campaigns for allowed roles", async () => {
    const { user, token } = await createUserAndToken({ email: "analyst@lumisec.io", role: "soc_analyst" });

    await Campaign.create({
        name: "Phish test",
        template: {
            subject: "Test",
            senderName: "LumiSec",
            senderEmail: "security@lumisec.io",
            htmlBody: "<p>Test</p>"
        },
        createdBy: user._id
    });

    const response = await request(app)
        .get("/api/phishing")
        .set("Authorization", `Bearer ${token}`);

    assert.equal(response.status, 200);
    assert.equal(response.body.success, true);
    assert.equal(response.body.data.length, 1);
});

test("GET /api/phishing is blocked for unauthorized role", async () => {
    const { token } = await createUserAndToken({ email: "auditor@lumisec.io", role: "auditor" });

    const response = await request(app)
        .get("/api/phishing")
        .set("Authorization", `Bearer ${token}`);

    assert.equal(response.status, 403);
    assert.equal(response.body.success, false);
});
