# SOAR Connector Integration Report

**Date:** 2026-06-12  
**Scope:** Optional compatibility layer — no business logic changes

## Summary

Added a standalone integration layer that allows the SOAR module to optionally delegate connector discovery, testing, and execution to an external Python Connector Engine. **Default mode is `local`** — all existing behavior is preserved.

---

## Files Created

| File | Purpose |
|------|---------|
| `src/modules/soar/services/connectorEngineClient.js` | HTTP client: `getConnectors`, `testConnector`, `executeConnectorAction`, `getHealth` |
| `src/modules/soar/services/connectorDiscoveryService.js` | Fetch + cache metadata; enrich existing `Connector.config.engineMetadata` |
| `src/modules/soar/services/connectorExecutionService.js` | Vault decrypt, engine execute, audit logging, failover |
| `src/modules/soar/services/connectorHealthService.js` | Engine and connector availability checks |
| `test/connector-engine-integration.test.js` | 9 new integration tests |
| `SOAR_CONNECTOR_INTEGRATION.md` | Architecture and usage documentation |
| `SOAR_CONNECTOR_INTEGRATION_REPORT.md` | This report |

---

## Files Modified

| File | Change |
|------|--------|
| `config/.env.example` | Added connector engine env vars |
| `package.json` | Added `test:connector-engine` script only |

### Files Intentionally NOT Modified

| Area | Status |
|------|--------|
| `playbookWorker.js` | Unchanged |
| `playbookEngine.js` | Unchanged |
| `incident.service.js` | Unchanged |
| `connector.service.js` | Unchanged |
| `integration.service.js` | Unchanged |
| `soar.router.js` / RBAC | Unchanged |
| Database models | Unchanged |
| Existing test files | Unchanged |

---

## New Services

### connectorEngineClient.js

- Reads `CONNECTOR_ENGINE_URL`, `CONNECTOR_ENGINE_API_KEY`
- Exposes `getConnectorMode()` / `isEngineMode()` for `SOAR_CONNECTOR_MODE`
- Retries on transient failures via `axios-retry`

### connectorDiscoveryService.js

- In-memory cache (`CONNECTOR_DISCOVERY_CACHE_MS`)
- `enrichExistingConnectors()` — updates `config.engineMetadata` only on name match
- Never creates or deletes connector records

### connectorExecutionService.js

- `buildConnectorConfig()` — CredentialVault AES decrypt
- `executeConnectorAction()` — returns `{ mode: "local", executed: false }` by default
- `testConnectorViaEngine()` — optional engine delegation for connector tests
- Audit: `IntegrationAction` + structured Winston logs (`connector`, `action`, `durationMs`, `status`)

### connectorHealthService.js

- `checkEngineAvailability()`, `checkConnectorAvailability()`, `getHealthSummary()`

---

## Test Results

```
npm run test:connector-engine

9 tests — 9 passed — 0 failed
```

| Test | Result |
|------|--------|
| Default mode is local | ✅ |
| Local mode skips engine HTTP | ✅ |
| Engine mode executes + audits | ✅ |
| Engine failure returns failover | ✅ |
| Discovery cache works | ✅ |
| Enrichment only on matched records | ✅ |
| Vault config decryption | ✅ |
| Health summary | ✅ |
| testConnectorViaEngine mode gating | ✅ |

Existing `test/soar.api.test.js` — **not modified, not re-run as part of this task**.

---

## Feature Flag Behavior

| `SOAR_CONNECTOR_MODE` | Behavior |
|-----------------------|----------|
| `local` (default) | Zero engine HTTP calls from execution service; existing code paths unaffected |
| `engine` | Execution/test functions delegate to Python when explicitly called |

No existing HTTP endpoints were added or changed. Feature flag is consumed only inside the new services.

---

## Risks & Mitigations

| Risk | Severity | Mitigation |
|------|----------|------------|
| Engine unavailable in `engine` mode | Medium | `failover: true` returned; callers use local handlers |
| Enrichment name mismatch | Low | Only matched records updated; unmatched skipped |
| API key exposure in logs | Low | Credentials decrypted server-side only; not logged |
| Opt-in wiring not yet done | Info | Services exported; existing flows unchanged until imported |
| Partial OpenAPI coverage | Info | No route changes in this task |

---

## Recommended Next Steps (optional, out of scope)

1. Wire `executeConnectorAction()` into specific integration call sites behind `SOAR_CONNECTOR_MODE=engine`
2. Schedule `enrichExistingConnectors()` via a worker (without changing connector CRUD)
3. Add read-only health endpoint exposing `getHealthSummary()` (new route only)

---

## Conclusion

The compatibility layer is complete, tested, and documented. The SOAR module continues to operate exactly as before unless `SOAR_CONNECTOR_MODE=engine` is set **and** the new services are explicitly invoked by calling code.
