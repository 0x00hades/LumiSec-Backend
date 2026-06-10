import test from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { buildTestApp, clearTestDb, closeTestEnv, initTestEnv } from "./helpers/testApp.js";
import { Incident, User } from "../database/index.js";
import { generateToken } from "../src/utils/token.js";
import { incidentStatus } from "../src/utils/constant/enums.js";

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
