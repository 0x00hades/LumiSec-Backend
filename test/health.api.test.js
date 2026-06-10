import test from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { buildTestApp } from "./helpers/testApp.js";

const app = buildTestApp();

test("GET /health returns ok", async () => {
    const response = await request(app).get("/health");

    assert.equal(response.status, 200);
    assert.equal(response.body.status, "ok");
    assert.equal(response.body.service, "LumiSec API");
});
