import test from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { mock } from "node:test";
import axios from "axios";
import { clearTestDb, closeTestEnv, initTestEnv } from "./helpers/testApp.js";
import { NetworkAsset, NetworkFlowMetric, NetworkMisconfiguration, SniffingSession, User } from "../database/index.js";
import { generateToken } from "../src/utils/token.js";
import { normalizePortsInput, parsePortRange } from "../src/utils/helpers/networkPortUtils.js";
import {
    aggregatePacketsToFlowMetrics,
    buildFlowMetric
} from "../src/utils/helpers/networkFlowMetrics.js";
import { sniffingSessionStatus } from "../src/utils/constant/enums.js";

let app;
let axiosMock;

const defaultAxiosWorkerMock = async (url, payload) => {
    if (url.endsWith("/discover")) {
        return {
            data: {
                runnerJobId: "disc-001",
                assets: [
                    {
                        ip: "10.0.0.15",
                        mac: "00:11:22:33:44:55",
                        hostname: "edge-fw",
                        osType: "linux",
                        vendor: "unknown",
                        status: "active",
                        metadata: { discoveryMethod: "worker" }
                    }
                ]
            }
        };
    }

    if (url.endsWith("/scan-ports")) {
        return {
            data: {
                runnerJobId: "scan-001",
                asset: {
                    ip: payload.target,
                    mac: "00:11:22:33:44:66",
                    hostname: "app-server",
                    osType: "linux",
                    vendor: "unknown",
                    status: "active",
                    openPorts: [
                        {
                            port: 23,
                            protocol: "tcp",
                            service: "telnet",
                            banner: "Telnet Server",
                            state: "open",
                            detectedAt: new Date()
                        }
                    ],
                    metadata: { scanMethod: "worker" }
                }
            }
        };
    }

    if (url.endsWith("/sniffing/start")) {
        return {
            data: {
                runnerJobId: "sniff-001",
                status: "completed",
                packets: [
                    {
                        timestamp: new Date(),
                        interface: payload.interfaceName,
                        filter: payload.filter,
                        src_ip: "10.0.0.5",
                        dst_ip: "10.0.0.20",
                        protocol: "TCP",
                        src_port: 51514,
                        dst_port: 80,
                        size: 512
                    }
                ]
            }
        };
    }

    throw new Error(`Unexpected worker URL: ${url}`);
};

const resetAxiosWorkerMock = () => {
    axiosMock.mock.mockImplementation(defaultAxiosWorkerMock);
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
    process.env.LUMINET_SCAN_MODE = "worker";
    process.env.LUMINET_SNIFFING_MODE = "worker";
    process.env.LUMINET_SCANNER_WORKER_URL = "http://scanner-worker.test";
    process.env.LUMINET_SNIFFER_WORKER_URL = "http://sniffer-worker.test";

    axiosMock = mock.method(axios, "post", defaultAxiosWorkerMock);

    await initTestEnv();
    const { buildTestApp } = await import("./helpers/testApp.js");
    app = buildTestApp();
});

test.after(async () => {
    axiosMock.mock.restore();
    await closeTestEnv();
});

test.beforeEach(async () => {
    resetAxiosWorkerMock();
    await clearTestDb();
});

test("parsePortRange parses comma and range syntax", () => {
    assert.deepEqual(parsePortRange("22,80,443"), [22, 80, 443]);
    assert.deepEqual(parsePortRange("20-22"), [20, 21, 22]);
});

test("normalizePortsInput accepts arrays and comma/range strings", () => {
    assert.deepEqual(normalizePortsInput([22, 80, 443]), [22, 80, 443]);
    assert.deepEqual(normalizePortsInput("22,80,443"), [22, 80, 443]);
    assert.deepEqual(normalizePortsInput("20-25"), [20, 21, 22, 23, 24, 25]);
    assert.throws(() => normalizePortsInput([]), /at least one valid port/);
});

test("aggregatePacketsToFlowMetrics derives metrics from captured packets", () => {
    const packets = [
        { src_ip: "10.0.0.5", dst_ip: "10.0.0.20", protocol: "TCP", size: 512 },
        { src_ip: "10.0.0.5", dst_ip: "10.0.0.20", protocol: "TCP", size: 512 }
    ];

    const metrics = aggregatePacketsToFlowMetrics(packets, 2);
    assert.equal(metrics.length, 1);
    assert.equal(metrics[0].sourceIp, "10.0.0.5");
    assert.equal(metrics[0].packetsPerSecond, 1);
});

test("POST /api/luminet/network/discover persists worker-discovered assets", async () => {
    const { token } = await createUserAndToken({ email: "netops@lumisec.io", role: "it_manager" });

    const response = await request(app)
        .post("/api/luminet/network/discover")
        .set("Authorization", `Bearer ${token}`)
        .send({ subnet: "10.0.0.0/24" });

    assert.equal(response.status, 201);
    assert.equal(response.body.data.runner_provider, "worker");
    assert.equal(response.body.data.discovered_count, 1);

    const asset = await NetworkAsset.findOne({ ip: "10.0.0.15" });
    assert.ok(asset);
    assert.equal(asset.mac, "00:11:22:33:44:55");
});

test("POST /api/luminet/network/discover is idempotent for the same ip", async () => {
    const { token } = await createUserAndToken({ email: "rediscover@lumisec.io", role: "it_manager" });

    let discoveryCount = 0;
    axiosMock.mock.mockImplementation(async (url) => {
        if (url.endsWith("/discover")) {
            discoveryCount += 1;
            return {
                data: {
                    runnerJobId: `disc-${discoveryCount}`,
                    assets: [{
                        ip: "10.0.0.15",
                        mac: discoveryCount === 1 ? "02:00:0A:00:00:0F" : "00:11:22:33:44:55",
                        hostname: "edge-fw",
                        osType: "linux",
                        vendor: discoveryCount === 1 ? "unresolved" : "known",
                        status: "active",
                        metadata: { discoveryMethod: "worker" }
                    }]
                }
            };
        }
        throw new Error(`Unexpected worker URL: ${url}`);
    });

    const first = await request(app)
        .post("/api/luminet/network/discover")
        .set("Authorization", `Bearer ${token}`)
        .send({ subnet: "10.0.0.0/24" });

    const second = await request(app)
        .post("/api/luminet/network/discover")
        .set("Authorization", `Bearer ${token}`)
        .send({ subnet: "10.0.0.0/24" });

    assert.equal(first.status, 201);
    assert.equal(second.status, 201);
    assert.equal(await NetworkAsset.countDocuments(), 1);

    const asset = await NetworkAsset.findOne({ ip: "10.0.0.15" });
    assert.equal(asset.mac, "00:11:22:33:44:55");
    assert.equal(asset.vendor, "known");
});

test("POST /api/luminet/network/scan-ports creates misconfigurations from real open ports", async () => {
    const { token } = await createUserAndToken({ email: "scan@lumisec.io", role: "detection_engineer" });

    await NetworkAsset.create({
        ip: "10.0.0.25",
        mac: "02:00:0A:00:00:19",
        osType: "unknown",
        status: "active"
    });

    const response = await request(app)
        .post("/api/luminet/network/scan-ports")
        .set("Authorization", `Bearer ${token}`)
        .send({ target: "10.0.0.25", ports: [20, 21, 22, 23, 24, 25], scanMode: "CONNECT" });

    assert.equal(response.status, 201);
    assert.deepEqual(response.body.data.ports, [20, 21, 22, 23, 24, 25]);
    assert.equal(response.body.data.scanMode, "CONNECT");
    assert.equal(response.body.data.open_ports.length, 1);
    assert.equal(response.body.data.open_ports[0].port, 23);
    assert.equal(response.body.data.misconfigurations.length, 1);
    assert.equal(await NetworkAsset.countDocuments(), 1);

    const asset = await NetworkAsset.findOne({ ip: "10.0.0.25" });
    assert.equal(asset.mac, "00:11:22:33:44:66");

    const misconfig = await NetworkMisconfiguration.findOne({ type: "telnet_enabled" });
    assert.ok(misconfig);
    assert.equal(misconfig.assetIp, "10.0.0.25");
});

test("POST /api/luminet/network/scan-ports normalizes comma-separated port strings", async () => {
    const { token } = await createUserAndToken({ email: "scan-string@lumisec.io", role: "detection_engineer" });

    const response = await request(app)
        .post("/api/luminet/network/scan-ports")
        .set("Authorization", `Bearer ${token}`)
        .send({ target: "10.0.0.25", ports: "22,80,443", scanMode: "CONNECT" });

    assert.equal(response.status, 201);
    assert.deepEqual(response.body.data.ports, [22, 80, 443]);
});

test("POST /api/luminet/network/scan-ports rejects empty ports and invalid scanMode", async () => {
    const { token } = await createUserAndToken({ email: "scan-invalid@lumisec.io", role: "detection_engineer" });

    const emptyPorts = await request(app)
        .post("/api/luminet/network/scan-ports")
        .set("Authorization", `Bearer ${token}`)
        .send({ target: "10.0.0.25", ports: [], scanMode: "CONNECT" });

    assert.equal(emptyPorts.status, 422);

    const invalidMode = await request(app)
        .post("/api/luminet/network/scan-ports")
        .set("Authorization", `Bearer ${token}`)
        .send({ target: "10.0.0.25", ports: [22], scanMode: "FAST" });

    assert.equal(invalidMode.status, 422);
});

test("POST /api/luminet/network/scan-ports rejects legacy and unknown fields", async () => {
    const { token } = await createUserAndToken({ email: "scan-legacy@lumisec.io", role: "detection_engineer" });

    const legacyType = await request(app)
        .post("/api/luminet/network/scan-ports")
        .set("Authorization", `Bearer ${token}`)
        .send({ target: "10.0.0.25", ports: [22], type: "CONNECT" });

    assert.equal(legacyType.status, 422);

    const unknownFields = await request(app)
        .post("/api/luminet/network/scan-ports")
        .set("Authorization", `Bearer ${token}`)
        .send({ target: "10.0.0.25", ports: [22], scanMode: "CONNECT", portRange: "1-1024", speed: "fast" });

    assert.equal(unknownFields.status, 422);
});

test("POST /api/luminet/sniffing/start requires worker and stores captured packets", async () => {
    const { token } = await createUserAndToken({ email: "sniff@lumisec.io", role: "soc_analyst" });

    const response = await request(app)
        .post("/api/luminet/sniffing/start")
        .set("Authorization", `Bearer ${token}`)
        .send({ interface: "eth0", duration_sec: 30, filter: "tcp port 80" });

    assert.equal(response.status, 201);
    assert.equal(response.body.data.runner_provider, "worker");
    assert.equal(response.body.data.packet_count, 1);

    const session = await SniffingSession.findById(response.body.data.session_id);
    assert.equal(session.samplePackets[0].src_ip, "10.0.0.5");
});

test("GET /api/luminet/network/flow-metrics returns empty data without seeding mock metrics", async () => {
    const { token } = await createUserAndToken({ email: "flows@lumisec.io", role: "soc_analyst" });

    const response = await request(app)
        .get("/api/luminet/network/flow-metrics")
        .set("Authorization", `Bearer ${token}`);

    assert.equal(response.status, 200);
    assert.equal(response.body.data.length, 0);
    assert.equal(await NetworkFlowMetric.countDocuments(), 0);
});

test("GET /api/luminet/network/flow-metrics aggregates metrics from sniffing sessions", async () => {
    const { user, token } = await createUserAndToken({ email: "flows2@lumisec.io", role: "soc_analyst" });

    await SniffingSession.create({
        interfaceName: "eth0",
        durationSec: 10,
        filter: "ip",
        status: sniffingSessionStatus.COMPLETED,
        requestedBy: user._id,
        startedAt: new Date(),
        completedAt: new Date(),
        packetCount: 2,
        byteCount: 1024,
        samplePackets: [
            { src_ip: "10.0.0.5", dst_ip: "10.0.0.20", protocol: "TCP", size: 512 },
            { src_ip: "10.0.0.5", dst_ip: "10.0.0.20", protocol: "TCP", size: 512 }
        ],
        runnerProvider: "worker"
    });

    const response = await request(app)
        .get("/api/luminet/network/flow-metrics")
        .set("Authorization", `Bearer ${token}`);

    assert.equal(response.status, 200);
    assert.equal(response.body.data.length, 1);
    assert.equal(response.body.data[0].sourceIp, "10.0.0.5");
});

test("startPacketCapture rejects unsupported local sniffing mode", async () => {
    process.env.LUMINET_SNIFFING_MODE = "local";
    const { startPacketCapture } = await import("../src/utils/helpers/networkRunner.js");

    await assert.rejects(
        () => startPacketCapture({ interfaceName: "eth0", durationSec: 10, filter: "ip" }),
        /Local packet capture is not supported/
    );

    process.env.LUMINET_SNIFFING_MODE = "worker";
});

test("buildFlowMetric flags anomalies from observed packet rate", () => {
    const metric = buildFlowMetric({
        sourceIp: "10.0.0.5",
        destinationIp: "10.0.0.20",
        packetsPerSecond: 250,
        bandwidthKbps: 4096
    });

    assert.equal(metric.isAnomaly, true);
    assert.equal(metric.severity, "high");
});
