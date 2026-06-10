import test from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { buildTestApp, clearTestDb, closeTestEnv, initTestEnv } from "./helpers/testApp.js";

const app = buildTestApp();

test.before(async () => {
    await initTestEnv();
});

test.after(async () => {
    await closeTestEnv();
});

test.beforeEach(async () => {
    await clearTestDb();
});

test("POST /api/auth/signup creates a user and returns token", async () => {
    const response = await request(app).post("/api/auth/signup").send({
        name: "Admin User",
        email: "admin@lumisec.io",
        password: "Password123",
        role: "admin",
        department: "SOC"
    });

    assert.equal(response.status, 201);
    assert.equal(response.body.success, true);
    assert.equal(response.body.data.user.email, "admin@lumisec.io");
    assert.ok(response.body.data.token);
});

test("POST /api/auth/login returns 401 for wrong password", async () => {
    await request(app).post("/api/auth/signup").send({
        name: "Admin User",
        email: "admin@lumisec.io",
        password: "Password123",
        role: "admin",
        department: "SOC"
    });

    const response = await request(app).post("/api/auth/login").send({
        email: "admin@lumisec.io",
        password: "WrongPass123"
    });

    assert.equal(response.status, 401);
    assert.equal(response.body.success, false);
});

test("GET /api/auth/profile requires token", async () => {
    const response = await request(app).get("/api/auth/profile");

    assert.equal(response.status, 401);
    assert.equal(response.body.success, false);
});

test("GET /api/auth/profile returns current user with a valid token", async () => {
    const signupResponse = await request(app).post("/api/auth/signup").send({
        name: "Analyst User",
        email: "analyst@lumisec.io",
        password: "Password123",
        role: "soc_analyst",
        department: "SOC"
    });

    const token = signupResponse.body.data.token;

    const response = await request(app)
        .get("/api/auth/profile")
        .set("Authorization", `Bearer ${token}`);

    assert.equal(response.status, 200);
    assert.equal(response.body.success, true);
    assert.equal(response.body.data.email, "analyst@lumisec.io");
});
