import test from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { buildTestApp, clearTestDb, closeTestEnv, initTestEnv } from "./helpers/testApp.js";
import { Finding, User } from "../database/index.js";
import { generateToken } from "../src/utils/token.js";
import { findingStatus } from "../src/utils/constant/enums.js";

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
            riskRating: "high"
        });

    assert.equal(response.status, 201);
    assert.equal(response.body.success, true);
    assert.equal(response.body.data.title, "Missing MFA");
});

test("GET /api/grc/findings returns findings", async () => {
    const { user, token } = await createUserAndToken({ email: "manager@lumisec.io", role: "compliance_manager" });

    await Finding.create({
        title: "Password policy gap",
        description: "Weak password length",
        riskRating: "medium",
        createdBy: user._id
    });

    const response = await request(app)
        .get("/api/grc/findings")
        .set("Authorization", `Bearer ${token}`);

    assert.equal(response.status, 200);
    assert.equal(response.body.success, true);
    assert.equal(response.body.data.length, 1);
});

test("PATCH /api/grc/findings/:findingId/close closes a pending retest finding", async () => {
    const { user, token } = await createUserAndToken({ email: "auditor2@lumisec.io", role: "auditor" });

    const finding = await Finding.create({
        title: "Open port",
        description: "Unnecessary port open",
        riskRating: "high",
        status: findingStatus.PENDING_RETEST,
        createdBy: user._id
    });

    const response = await request(app)
        .patch(`/api/grc/findings/${finding._id}/close`)
        .set("Authorization", `Bearer ${token}`)
        .send({ retestResult: "effective" });

    assert.equal(response.status, 200);
    assert.equal(response.body.success, true);
    assert.equal(response.body.data.status, findingStatus.CLOSED);
});
