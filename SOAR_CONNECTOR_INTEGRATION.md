# SOAR Connector Engine Integration

Optional compatibility layer between the existing Node.js SOAR module and an external **Python Connector Engine**.

**Default behavior is unchanged.** With `SOAR_CONNECTOR_MODE=local` (default), all existing incident, playbook, connector, and integration flows run exactly as before.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Existing SOAR Module                      │
│  playbookWorker │ connector.service │ integration.service   │
│         (unchanged — local execution by default)             │
└───────────────────────────┬─────────────────────────────────┘
                            │ optional import
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              Compatibility Layer (new services)              │
│  connectorEngineClient.js                                    │
│  connectorDiscoveryService.js                                │
│  connectorExecutionService.js                                │
│  connectorHealthService.js                                   │
└───────────────────────────┬─────────────────────────────────┘
                            │ HTTP (when SOAR_CONNECTOR_MODE=engine)
                            ▼
┌─────────────────────────────────────────────────────────────┐
│           Python Connector Engine (external)                 │
│  GET  /api/v1/connectors                                     │
│  POST /api/v1/connectors/{connector}/test                    │
│  POST /api/v1/connectors/execute                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Execution Flow

### Local mode (default)

```
Caller → connectorExecutionService.executeConnectorAction()
       → { mode: "local", executed: false }
       → Caller continues with existing in-process integration (firewall.js, elk.js, etc.)
```

No HTTP calls are made. Playbook worker, connector tests, and integration endpoints behave as today.

### Engine mode

```
Caller → connectorExecutionService.executeConnectorAction()
       → buildConnectorConfig() → CredentialVault decrypt
       → connectorEngineClient.executeConnectorAction()
       → POST /api/v1/connectors/execute
       → normalized ActionResult + IntegrationAction audit log
```

### Failover

If engine mode is active but the engine is unreachable or returns an error:

```
{ mode: "engine-failed", failover: true, executed: false }
```

Callers should fall back to existing local handlers when `failover: true`.

---

## Discovery & Enrichment

`connectorDiscoveryService.js` fetches metadata from the engine and **enriches existing** `Connector` documents only:

- Matches by `Connector.name` (case-insensitive) or `config.engineAlias`
- Writes metadata under `config.engineMetadata` (no schema migration)
- Does **not** create new connector records
- Does **not** modify `name`, `type`, `vaultId`, or other core fields

```javascript
import { enrichExistingConnectors } from "./services/connectorDiscoveryService.js";

await enrichExistingConnectors({ forceRefresh: true });
```

Metadata is cached in memory for `CONNECTOR_DISCOVERY_CACHE_MS` (default 5 minutes).

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `SOAR_CONNECTOR_MODE` | `local` | `local` = existing behavior; `engine` = delegate to Python |
| `CONNECTOR_ENGINE_URL` | `http://localhost:4101` | Base URL of the Python engine |
| `CONNECTOR_ENGINE_API_KEY` | _(empty)_ | Sent as `X-Api-Key` header when set |
| `CONNECTOR_ENGINE_TIMEOUT_MS` | `15000` | HTTP timeout |
| `CONNECTOR_ENGINE_RETRY_COUNT` | `2` | Retries on 5xx / network errors |
| `CONNECTOR_DISCOVERY_CACHE_MS` | `300000` | In-memory catalog cache TTL |

---

## Service API

### `connectorEngineClient.js`

| Function | Python endpoint |
|----------|-----------------|
| `getHealth()` | `GET /health` |
| `getConnectors()` | `GET /api/v1/connectors` |
| `testConnector(name, { config })` | `POST /api/v1/connectors/{name}/test` |
| `executeConnectorAction({ connector, action, params, config, context })` | `POST /api/v1/connectors/execute` |

### `connectorExecutionService.js`

| Function | Purpose |
|----------|---------|
| `buildConnectorConfig(connectorId)` | Vault decrypt + config merge |
| `executeConnectorAction(opts)` | Mode-aware execution with audit |
| `testConnectorViaEngine(connectorId, user)` | Engine-mode connector test |

### `connectorHealthService.js`

| Function | Purpose |
|----------|---------|
| `checkEngineAvailability()` | Engine reachability |
| `checkConnectorAvailability(name)` | Catalog + engine status |
| `getHealthSummary()` | Combined health snapshot |

---

## Audit Logging

Every engine execution and test logs:

| Field | Destination |
|-------|-------------|
| `connector` | Winston `connector_engine_audit` |
| `action` | Winston `connector_engine_audit` |
| `durationMs` | Winston + `IntegrationAction.request` |
| `status` | `success` / `failed` → `IntegrationAction.status` |

---

## Enabling Engine Mode

1. Deploy the Python Connector Engine and set `CONNECTOR_ENGINE_URL`
2. Optionally set `CONNECTOR_ENGINE_API_KEY`
3. Set `SOAR_CONNECTOR_MODE=engine`
4. Import and call from integration points when ready:

```javascript
import { executeConnectorAction } from "./services/connectorExecutionService.js";

const result = await executeConnectorAction({
    connectorId,
    action: "block_ip",
    params: { ip },
    context: { incidentId },
    user
});

if (!result.executed && result.failover) {
    // existing local handler
}
```

**No existing file is required to change** — engine mode is opt-in per call site.

---

## Tests

```bash
npm run test:connector-engine
```

9 integration tests cover local mode, engine mode, failover, discovery enrichment, vault config, and health checks.
