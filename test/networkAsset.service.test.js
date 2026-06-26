import test from "node:test";
import assert from "node:assert/strict";
import { clearTestDb, closeTestEnv, initTestEnv } from "./helpers/testApp.js";
import { NetworkAsset } from "../database/index.js";
import { networkAssetStatus } from "../src/utils/constant/enums.js";
import {
    normalizeAssetPayload,
    upsertNetworkAsset
} from "../src/modules/network/services/networkAsset.service.js";

test.before(async () => {
    process.env.NODE_ENV = "test";
    await initTestEnv();
});

test.after(async () => {
    await closeTestEnv();
});

test.beforeEach(async () => {
    await clearTestDb();
});

test("upsertNetworkAsset inserts a new asset by ip", async () => {
    const asset = await upsertNetworkAsset({
        ip: "10.0.0.15",
        mac: "00:11:22:33:44:55",
        osType: "linux"
    });

    assert.equal(asset.ip, "10.0.0.15");
    assert.equal(asset.mac, "00:11:22:33:44:55");
    assert.equal(await NetworkAsset.countDocuments(), 1);
});

test("upsertNetworkAsset updates existing asset when ip is rediscovered with new mac", async () => {
    const first = await upsertNetworkAsset({
        ip: "10.0.0.15",
        mac: "02:00:0A:00:00:0F",
        vendor: "unresolved",
        metadata: { discoveryMethod: "local_ping" }
    });

    const second = await upsertNetworkAsset({
        ip: "10.0.0.15",
        mac: "00:11:22:33:44:55",
        vendor: "known",
        metadata: { discoveryMethod: "worker" }
    });

    assert.equal(String(first._id), String(second._id));
    assert.equal(second.mac, "00:11:22:33:44:55");
    assert.equal(second.vendor, "known");
    assert.equal(await NetworkAsset.countDocuments(), 1);
});

test("upsertNetworkAsset preserves openPorts on port-scan update for same ip", async () => {
    await upsertNetworkAsset({
        ip: "10.0.0.25",
        mac: "00:11:22:33:44:66",
        osType: "linux"
    });

    const scanned = await upsertNetworkAsset({
        ip: "10.0.0.25",
        mac: "00:AA:BB:CC:DD:EE",
        openPorts: [{
            port: 23,
            protocol: "tcp",
            service: "telnet",
            banner: "Telnet Server",
            state: "open",
            detectedAt: new Date()
        }]
    });

    assert.equal(scanned.openPorts.length, 1);
    assert.equal(scanned.openPorts[0].port, 23);
    assert.equal(await NetworkAsset.countDocuments(), 1);
});

test("normalizeAssetPayload uppercases mac and requires ip", async () => {
    const normalized = normalizeAssetPayload({
        ip: " 10.0.0.8 ",
        mac: "aa:bb:cc:dd:ee:ff",
        status: networkAssetStatus.ACTIVE
    });

    assert.equal(normalized.ip, "10.0.0.8");
    assert.equal(normalized.mac, "AA:BB:CC:DD:EE:FF");

    assert.throws(
        () => normalizeAssetPayload({ mac: "00:11:22:33:44:55" }),
        /ip is required/i
    );
});
