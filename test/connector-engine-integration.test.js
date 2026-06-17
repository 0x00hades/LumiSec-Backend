import test from "node:test";
import assert from "node:assert/strict";
import { clearTestDb, closeTestEnv, initTestEnv } from "./helpers/testApp.js";
import { Connector, IntegrationAction, User, CredentialVault } from "../database/index.js";
import { connectorType } from "../src/utils/constant/enums.js";
import {
    configureEngineClientForTests,
    resetEngineClientForTests,
    getConnectorMode,
    isEngineMode
} from "../src/modules/soar/services/connectorEngineClient.js";
import {
    clearDiscoveryCache,
    enrichExistingConnectors,
    fetchConnectorMetadata
} from "../src/modules/soar/services/connectorDiscoveryService.js";
import {
    buildConnectorConfig,
    executeConnectorAction,
    testConnectorViaEngine
} from "../src/modules/soar/services/connectorExecutionService.js";
import {
    checkConnectorAvailability,
    checkEngineAvailability,
    getHealthSummary
} from "../src/modules/soar/services/connectorHealthService.js";

const mockEngineTransport = async (method, path, data) => {
    if (method === "get" && path === "/health") {
        return { status: "ok", service: "connector-engine", connectors: 2 };
    }
    if (method === "get" && path === "/api/v1/connectors") {
        return {
            connectors: [
                {
                    name: "fortigate",
                    version: "1.0.0",
                    description: "FortiGate firewall",
                    category: "firewall",
                    actions: ["block_ip", "unblock_ip"],
                    authTypes: ["bearer"],
                    status: "active"
                },
                {
                    name: "slack",
                    version: "1.0.0",
                    description: "Slack notifications",
                    category: "notification",
                    actions: ["send_message"],
                    authTypes: ["bearer"],
                    status: "active"
                }
            ]
        };
    }
    if (method === "post" && path === "/api/v1/connectors/fortigate/test") {
        return { success: true, connector: "fortigate", reachable: true };
    }
    if (method === "post" && path === "/api/v1/connectors/execute") {
        return {
            success: true,
            connector: data.connector,
            action: data.action,
            data: { executed: true, mock: true }
        };
    }
    throw new Error(`Unexpected mock request: ${method} ${path}`);
};

test.before(async () => {
    process.env.NODE_ENV = "test";
    process.env.SOAR_CONNECTOR_MODE = "local";
    process.env.CONNECTOR_ENGINE_URL = "http://connector-engine.test";
    process.env.CONNECTOR_ENGINE_API_KEY = "test-engine-key";
    await initTestEnv();
    configureEngineClientForTests(mockEngineTransport);
});

test.after(async () => {
    resetEngineClientForTests();
    clearDiscoveryCache();
    await closeTestEnv();
});

test.beforeEach(async () => {
    process.env.SOAR_CONNECTOR_MODE = "local";
    clearDiscoveryCache();
    await clearTestDb();
});

test("getConnectorMode defaults to local", () => {
    delete process.env.SOAR_CONNECTOR_MODE;
    assert.equal(getConnectorMode(), "local");
    assert.equal(isEngineMode(), false);
});

test("executeConnectorAction in local mode does not call engine", async () => {
    const result = await executeConnectorAction({
        connector: "fortigate",
        action: "block_ip",
        params: { ip: "203.0.113.1" }
    });

    assert.equal(result.mode, "local");
    assert.equal(result.executed, false);
});

test("executeConnectorAction in engine mode calls engine and audits", async () => {
    process.env.SOAR_CONNECTOR_MODE = "engine";

    const user = await User.create({
        name: "Engine Tester",
        email: "engine@test.io",
        password: "hash",
        role: "integration_admin",
        department: "SOC"
    });

    const connector = await Connector.create({
        name: "fortigate",
        type: connectorType.FIREWALL,
        createdBy: user._id
    });

    const result = await executeConnectorAction({
        connectorId: connector._id,
        action: "block_ip",
        params: { ip: "203.0.113.1" },
        user
    });

    assert.equal(result.mode, "engine");
    assert.equal(result.executed, true);
    assert.equal(result.success, true);
    assert.ok(result.durationMs >= 0);

    const audits = await IntegrationAction.find({ connectorId: connector._id });
    assert.equal(audits.length, 1);
    assert.equal(audits[0].request.action, "block_ip");
});

test("executeConnectorAction fails over when engine transport throws", async () => {
    process.env.SOAR_CONNECTOR_MODE = "engine";
    configureEngineClientForTests(async () => {
        throw new Error("engine unreachable");
    });

    const result = await executeConnectorAction({
        connector: "fortigate",
        action: "block_ip"
    });

    assert.equal(result.mode, "engine-failed");
    assert.equal(result.failover, true);
    assert.equal(result.executed, false);

    configureEngineClientForTests(mockEngineTransport);
});

test("fetchConnectorMetadata caches engine catalog", async () => {
    const first = await fetchConnectorMetadata();
    assert.equal(first.connectors.length, 2);
    assert.equal(first.cached, false);

    const second = await fetchConnectorMetadata();
    assert.equal(second.cached, true);
    assert.equal(second.connectors.length, 2);
});

test("enrichExistingConnectors only updates matching records", async () => {
    const user = await User.create({
        name: "Discovery Tester",
        email: "discovery@test.io",
        password: "hash",
        role: "integration_admin",
        department: "SOC"
    });

    const matched = await Connector.create({
        name: "fortigate",
        type: connectorType.FIREWALL,
        config: { host: "10.0.0.1" },
        createdBy: user._id
    });

    const unmatched = await Connector.create({
        name: "Legacy SIEM",
        type: connectorType.SIEM,
        config: { url: "http://localhost:9200" },
        createdBy: user._id
    });

    const result = await enrichExistingConnectors({ forceRefresh: true });

    assert.equal(result.enriched, 1);

    const refreshed = await Connector.findById(matched._id);
    assert.equal(refreshed.config.host, "10.0.0.1");
    assert.equal(refreshed.config.engineMetadata.engineName, "fortigate");
    assert.deepEqual(refreshed.config.engineMetadata.actions, ["block_ip", "unblock_ip"]);

    const untouched = await Connector.findById(unmatched._id);
    assert.equal(untouched.config.engineMetadata, undefined);
    assert.equal(untouched.name, "Legacy SIEM");
});

test("buildConnectorConfig decrypts vault secrets", async () => {
    const user = await User.create({
        name: "Vault Tester",
        email: "vault@test.io",
        password: "hash",
        role: "integration_admin",
        department: "SOC"
    });

    const { encryptSecret } = await import("../src/modules/soar/helpers/vaultCrypto.js");
    const encrypted = encryptSecret(JSON.stringify({ token: "secret-token" }));

    const vault = await CredentialVault.create({
        name: "Fortigate creds",
        description: "test",
        encryptedValue: encrypted.encryptedValue,
        iv: encrypted.iv,
        authTag: encrypted.authTag,
        createdBy: user._id
    });

    const connector = await Connector.create({
        name: "fortigate",
        type: connectorType.FIREWALL,
        config: { host: "10.0.0.1" },
        vaultId: vault._id,
        createdBy: user._id
    });

    const config = await buildConnectorConfig(connector._id);
    assert.equal(config.host, "10.0.0.1");
    assert.equal(config.token, "secret-token");
});

test("connector health services report engine and catalog status", async () => {
    process.env.SOAR_CONNECTOR_MODE = "engine";

    const engine = await checkEngineAvailability();
    assert.equal(engine.available, true);

    const connector = await checkConnectorAvailability("fortigate");
    assert.equal(connector.catalogMatch, true);
    assert.equal(connector.available, true);

    const summary = await getHealthSummary();
    assert.equal(summary.connectorMode, "engine");
    assert.equal(summary.engine.available, true);
});

test("testConnectorViaEngine delegates only in engine mode", async () => {
    const user = await User.create({
        name: "Test Connector",
        email: "test-conn@test.io",
        password: "hash",
        role: "integration_admin",
        department: "SOC"
    });

    const connector = await Connector.create({
        name: "fortigate",
        type: connectorType.FIREWALL,
        createdBy: user._id
    });

    const local = await testConnectorViaEngine(connector._id, user);
    assert.equal(local.mode, "local");
    assert.equal(local.delegated, false);

    process.env.SOAR_CONNECTOR_MODE = "engine";
    const engine = await testConnectorViaEngine(connector._id, user);
    assert.equal(engine.mode, "engine");
    assert.equal(engine.delegated, true);
    assert.equal(engine.success, true);
});
