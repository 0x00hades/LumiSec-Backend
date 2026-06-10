import test from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { buildTestApp, clearTestDb, closeTestEnv, initTestEnv } from "./helpers/testApp.js";
import { SigmaRule, User } from "../database/index.js";
import { generateToken } from "../src/utils/token.js";
import { ruleStatus } from "../src/utils/constant/enums.js";

const app = buildTestApp();

const createUserAndToken = async ({
    name = "Test User",
    email,
    role
}) => {
    const user = await User.create({
        name,
        email,
        password: "hashed-password",
        role,
        department: "SOC"
    });

    return {
        user,
        token: generateToken({ _id: user._id, role: user.role })
    };
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

test("GET /api/uctc/rules requires authentication", async () => {
    const response = await request(app).get("/api/uctc/rules");

    assert.equal(response.status, 401);
    assert.equal(response.body.success, false);
});

test("GET /api/uctc/rules is allowed for soc_analyst", async () => {
    const { user, token } = await createUserAndToken({
        email: "analyst@lumisec.io",
        role: "soc_analyst"
    });

    await SigmaRule.create({
        title: "Suspicious PowerShell",
        rawSigma: "title: test",
        targetSiem: "elastic",
        createdBy: user._id
    });

    const response = await request(app)
        .get("/api/uctc/rules")
        .set("Authorization", `Bearer ${token}`);

    assert.equal(response.status, 200);
    assert.equal(response.body.success, true);
    assert.equal(response.body.data.length, 1);
});

test("POST /api/uctc/rules rejects unauthorized role", async () => {
    const { token } = await createUserAndToken({
        email: "analyst2@lumisec.io",
        role: "soc_analyst"
    });

    const response = await request(app)
        .post("/api/uctc/rules")
        .set("Authorization", `Bearer ${token}`)
        .send({
            title: "Rule Name",
            rawSigma: "title: x",
            targetSiem: "elastic"
        });

    assert.equal(response.status, 403);
    assert.equal(response.body.success, false);
});

test("POST /api/uctc/rules validates payload", async () => {
    const { token } = await createUserAndToken({
        email: "deteng@lumisec.io",
        role: "detection_engineer"
    });

    const response = await request(app)
        .post("/api/uctc/rules")
        .set("Authorization", `Bearer ${token}`)
        .send({
            title: "",
            targetSiem: "invalid-siem"
        });

    assert.equal(response.status, 422);
    assert.equal(response.body.success, false);
});

test("POST /api/uctc/rules/:ruleId/deploy returns 404 when rule does not exist", async () => {
    const { token } = await createUserAndToken({
        email: "admin@lumisec.io",
        role: "admin"
    });

    const response = await request(app)
        .post("/api/uctc/rules/507f1f77bcf86cd799439011/deploy")
        .set("Authorization", `Bearer ${token}`);

    assert.equal(response.status, 404);
    assert.equal(response.body.success, false);
});

test("POST /api/uctc/rules/:ruleId/deploy returns 400 if not converted", async () => {
    const { user, token } = await createUserAndToken({
        email: "admin2@lumisec.io",
        role: "admin"
    });

    const rule = await SigmaRule.create({
        title: "Draft Rule",
        rawSigma: "title: draft",
        targetSiem: "elastic",
        status: ruleStatus.DRAFT,
        createdBy: user._id
    });

    const response = await request(app)
        .post(`/api/uctc/rules/${rule._id}/deploy`)
        .set("Authorization", `Bearer ${token}`);

    assert.equal(response.status, 400);
    assert.equal(response.body.success, false);
});

test("POST /api/uctc/rules/:ruleId/deploy sets rule to deployed", async () => {
    const { user, token } = await createUserAndToken({
        email: "admin3@lumisec.io",
        role: "admin"
    });

    const rule = await SigmaRule.create({
        title: "Converted Rule",
        rawSigma: "title: converted",
        targetSiem: "splunk",
        status: ruleStatus.CONVERTED,
        createdBy: user._id
    });

    const response = await request(app)
        .post(`/api/uctc/rules/${rule._id}/deploy`)
        .set("Authorization", `Bearer ${token}`);

    assert.equal(response.status, 200);
    assert.equal(response.body.success, true);
    assert.equal(response.body.data.status, ruleStatus.DEPLOYED);
    assert.ok(response.body.data.deployedAt);
});
