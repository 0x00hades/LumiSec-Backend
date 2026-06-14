# LumiSec Cyber Team Integration Handoff

This file is the backend handoff for the cyber and infrastructure teams.

It explains what is already implemented, what the backend still needs to finish the graduation project, what each team must provide, and exactly where every integration connects in the code.

## Quick Summary

The backend is ready for integration testing in mock mode, local network scan mode, and Docker sandbox mode. The remaining project work is mostly connecting real external tools:

- LumiNet needs a real scanner worker for Nmap-based discovery and port scanning.
- LumiNet needs a real sniffer worker for Scapy/libpcap packet capture.
- LumiNet needs real flow aggregation instead of seeded demo metrics.
- UCTC needs real SIEM deployment clients for Elastic, Splunk, or Sentinel.
- UCTC needs real SIEM alert feedback to tune noisy rules.
- SOAR and GRC need final endpoint contracts so LumiNet findings can trigger playbooks and risk records.

The backend already has the APIs, models, validation, environment switches, and integration placeholders for these items.

## Priority Integration Checklist

| Priority | Integration | Needed from cyber/infrastructure team | Backend location |
| --- | --- | --- | --- |
| 1 | Approved test environment | Test subnet, VM IPs, allowed scan profiles, cloud VM access | `.env`, deployment setup |
| 2 | LumiNet scanner worker | Nmap profiles, worker URL, response format, safe limits | `src/utils/helpers/networkRunner.js` |
| 3 | UCTC Docker sandbox | Docker host, approved images, resource limits | `src/utils/helpers/sandboxRunner.js` |
| 4 | LumiNet sniffer worker | Interface names, BPF filters, packet schema, worker URL | `src/utils/helpers/networkRunner.js` |
| 5 | SIEM deployment | SIEM API credentials, rule payload format, external rule ID response | `src/modules/uctc/uctc.controller.js` |
| 6 | SIEM alert feedback | Alert feedback webhook/payload from SIEM or SOC UI | `src/modules/uctc/uctc.tuning.controller.js` |
| 7 | Misconfiguration catalog | Signature list, severity, recommendation text | `src/modules/network/network.controller.js` |
| 8 | Flow anomaly logic | Baseline algorithm, thresholds, telemetry source | `database/models/networkFlowMetric.model.js` |
| 9 | SOAR/GRC handoff | Endpoint URLs, auth, request schema, retry policy | `src/modules/network/network.controller.js` |

## What The Backend Needs To Finish The Project

The backend team can finish the real implementation once these inputs are available:

- Final cloud/test network details:
  - Approved subnets.
  - Target machines.
  - Allowed scanning windows.
  - Scan rate limits.
- Scanner worker details:
  - Base URL.
  - Authentication if needed.
  - Exact Nmap commands/profiles.
  - JSON response format.
- Sniffer worker details:
  - Base URL.
  - Authentication if needed.
  - Allowed interfaces.
  - Packet fields returned by the worker.
  - Whether live packets are pushed, polled, or streamed.
- SIEM details:
  - Target SIEM for the demo.
  - API base URL.
  - Credentials.
  - Rule deployment request format.
  - Alert feedback payload format.
- SOAR and GRC details:
  - Endpoint URLs.
  - Auth method.
  - Required request bodies.
  - Expected success and failure responses.
- Detection content:
  - Misconfiguration signatures.
  - Flow anomaly thresholds.
  - Sigma templates for common LumiNet findings.
  - Safe attack scenarios for UCTC lab testing.

## Current Backend Status

| Area | Status | What works now | What still needs integration |
| --- | --- | --- | --- |
| UCTC Sigma validation | Ready for MVP testing | Validates required Sigma fields and detection structure | Replace/extend with pySigma for full Sigma compatibility if needed |
| UCTC Sigma conversion | Ready for MVP testing | Converts supported Sigma patterns into SIEM query previews | Add exact Elastic/Splunk/Sentinel field mappings from the SIEM team |
| UCTC lab sandbox | Real-ready | Mock mode works now; Docker mode can execute PowerShell, Python, and Bash in isolated containers | Provide cloud runner/Docker host and approved sandbox images |
| UCTC SIEM deployment | Integration placeholder | Deployment endpoint validates workflow and marks rules deployed | Connect real Elastic/Splunk/Sentinel deployment APIs |
| UCTC tuning | Ready for testing | Stores alert feedback, noisy-rule stats, and tuning suggestions in MongoDB | Feed real SIEM alert feedback/webhooks |
| LumiNet discovery | Real-ready | Mock mode works; local mode uses ping plus ARP lookup | Add scanner worker for cloud scanning, Nmap, UDP, SYN, OS fingerprinting |
| LumiNet port scanning | Real-ready | Mock mode works; local mode performs real TCP connect scans | Add scanner worker for Nmap profiles, UDP scan, banners, and fingerprinting |
| LumiNet sniffing | Integration placeholder | Mock mode stores sample packets and emits Socket.IO event | Add Scapy/libpcap worker and real live packet streaming |
| LumiNet flow metrics | Demo-ready | API returns stored metrics and seeds sample baseline data when empty | Add NetFlow/packet aggregation and anomaly baseline logic |
| LumiNet misconfigurations | MVP logic | Detects risky exposed services from scan results | Add cyber-team signature catalog and severity mapping |
| LumiNet to UCTC | Implemented | UCTC can suggest rule ideas from LumiNet asset context | Later replace shared Mongo lookup with service call if tools split into services |
| LumiNet to SOAR/GRC/SIEM | Integration placeholder | Backend emits anomaly events and stores context | Connect SOAR trigger, GRC risk auto-log, and SIEM event forwarding |

## Required Tools And Services

### Core Backend

- Node.js runtime for the LumiSec backend.
- MongoDB for all UCTC and LumiNet data models.
- Redis for platform features that depend on cache, queues, or socket scaling.
- Cloud VM or server for production and test deployment.

### UCTC Sandbox

- Docker Engine on the test/cloud machine.
- Approved Docker images:
  - `mcr.microsoft.com/powershell:latest`
  - `python:3.12-alpine`
  - `bash:5.2`
- Optional future cloud runner API if Docker execution is moved out of the backend host.

### LumiNet Scanner

- Scanner worker service reachable from the backend.
- Recommended tools inside the scanner worker:
  - Nmap
  - Python 3.11+
  - `python-nmap` or direct Nmap XML/JSON parsing
- Cyber team should provide safe scan profiles:
  - Discovery scan
  - TCP connect scan
  - SYN scan if allowed
  - UDP scan if allowed
  - Service/banner detection
  - OS fingerprinting policy

### LumiNet Sniffer

- Sniffer worker service reachable from the backend.
- Recommended tools inside the sniffer worker:
  - Python 3.11+
  - Scapy
  - libpcap on Linux or Npcap on Windows
  - Optional `tcpdump`, `tshark`, or Zeek for deeper packet/flow extraction
- Cyber team should provide allowed interfaces, filters, packet fields, and retention rules.

### External Security Platforms

- SIEM API credentials and rule deployment format:
  - Elastic
  - Splunk
  - Microsoft Sentinel
- SOAR playbook trigger endpoint and authentication.
- GRC risk auto-log endpoint and authentication.
- Optional OpenCTI or threat-intel feed credentials if detection context should include threat intel.

## Environment Variables

These variables already exist in `config/.env.example`.

For normal backend development, keep mock modes enabled. For real integration testing, change only the integration being tested so failures are easy to isolate.

| Variable | Default | Real testing value | Used by |
| --- | --- | --- | --- |
| `UCTC_SANDBOX_MODE` | `mock` | `docker` | UCTC lab sandbox |
| `SIEM_DEPLOYMENT_MODE` | `mock` | SIEM-specific mode later | UCTC rule deployment |
| `LUMINET_SCAN_MODE` | `mock` | `local`, `worker`, or `cloud` | LumiNet discovery and port scan |
| `LUMINET_SNIFFING_MODE` | `mock` | `worker` or `cloud` | LumiNet packet capture |
| `LUMINET_SCANNER_WORKER_URL` | `http://localhost:4100` | scanner worker URL | LumiNet scanner worker |
| `LUMINET_SNIFFER_WORKER_URL` | `http://localhost:4200` | sniffer worker URL | LumiNet sniffer worker |

### UCTC

```env
UCTC_SANDBOX_MODE=mock
UCTC_SANDBOX_TIMEOUT_SEC=30
UCTC_SANDBOX_MEMORY=512m
UCTC_SANDBOX_CPUS=1
UCTC_SANDBOX_PIDS_LIMIT=128
UCTC_SANDBOX_USER=1000:1000
UCTC_MAX_OUTPUT_BYTES=50000
UCTC_SANDBOX_POWERSHELL_IMAGE=mcr.microsoft.com/powershell:latest
UCTC_SANDBOX_PYTHON_IMAGE=python:3.12-alpine
UCTC_SANDBOX_BASH_IMAGE=bash:5.2
SIEM_DEPLOYMENT_MODE=mock
```

Use `UCTC_SANDBOX_MODE=docker` when Docker is installed and the sandbox images are available.

### LumiNet

```env
LUMINET_SCAN_MODE=mock
LUMINET_SNIFFING_MODE=mock
LUMINET_SCAN_TIMEOUT_SEC=60
LUMINET_SCAN_CONCURRENCY=64
LUMINET_MAX_DISCOVERY_HOSTS=256
LUMINET_PING_TIMEOUT_MS=1000
LUMINET_CONNECT_TIMEOUT_MS=1200
LUMINET_MAX_PACKET_SAMPLES=100
LUMINET_SCANNER_WORKER_URL=http://localhost:4100
LUMINET_SNIFFER_WORKER_URL=http://localhost:4200
```

Use `LUMINET_SCAN_MODE=local` for real local ping discovery and TCP connect scanning.

Use `LUMINET_SCAN_MODE=worker` or `cloud` when the scanner worker is ready.

Use `LUMINET_SNIFFING_MODE=worker` or `cloud` when the sniffer worker is ready.

## Integration Locations In Code

| Integration | Code location | Backend function |
| --- | --- | --- |
| LumiNet scan provider switch | `src/utils/helpers/networkRunner.js` | `discoverHosts`, `scanHostPorts` |
| LumiNet discovery endpoint | `src/modules/network/network.controller.js` | `discoverNetwork` |
| LumiNet port scan endpoint | `src/modules/network/network.controller.js` | `scanPorts` |
| LumiNet sniffer provider switch | `src/utils/helpers/networkRunner.js` | `startPacketCapture` |
| LumiNet sniffing endpoint | `src/modules/network/network.controller.js` | `startSniffing` |
| LumiNet live samples | `src/modules/network/network.controller.js` | `getLiveStreamSamples` |
| LumiNet misconfig generation | `src/modules/network/network.controller.js` | `createMisconfigurationsForAsset` |
| LumiNet flow/anomaly output | `src/modules/network/network.controller.js` | `getFlowMetrics` |
| UCTC sandbox provider | `src/utils/helpers/sandboxRunner.js` | `runScriptInSandbox` |
| UCTC lab endpoints | `src/modules/uctc/uctc.lab.controller.js` | `executeScript`, `executeScenario` |
| UCTC SIEM deployment | `src/modules/uctc/uctc.controller.js` | `deployRule` |
| UCTC SIEM feedback | `src/modules/uctc/uctc.tuning.controller.js` | `ingestAlertFeedback` |
| LumiNet to UCTC suggestions | `src/modules/uctc/uctc.controller.js` | `suggestRulesFromNetwork` |
| LumiNet suggestion logic | `src/utils/helpers/networkDetectionContext.js` | `buildNetworkDetectionSuggestions` |

## Backend Endpoints For Integration

All endpoints require authentication. Role authorization is already handled in the routers.

### LumiNet

All endpoints are mounted under both `/api/v1` and `/api/luminet`.

- `POST /api/v1/network/discover`
  - Purpose: discover live hosts in a subnet and update asset inventory.
- `POST /api/v1/network/scan-ports`
  - Purpose: scan a target host, update open services, and create misconfiguration records.
- `GET /api/v1/assets/inventory`
  - Purpose: list discovered assets for dashboards and SOC/GRC views.
- `GET /api/v1/assets/details/:mac`
  - Purpose: fetch one asset by MAC address with related misconfigurations.
- `GET /api/v1/assets/context/:ip`
  - Purpose: provide asset context to SOC, UCTC, SOAR, and GRC.
- `POST /api/v1/sniffing/start`
  - Purpose: start packet capture through mock or sniffer worker mode.
- `GET /api/v1/sniffing/live-stream`
  - Purpose: return recent packet samples until full live streaming is connected.
- `GET /api/v1/network/misconfigurations`
  - Purpose: list weak services and network misconfigurations.
- `GET /api/v1/network/flow-metrics`
  - Purpose: return flow metrics and anomaly indicators.

### UCTC Cross-Tool Endpoint

- `POST /api/v1/rules/suggest-from-network`
  - Purpose: generate Sigma-rule ideas from LumiNet asset context, open ports, misconfigurations, and flow anomalies.

Request body:

```json
{
  "ip": "192.168.1.50"
}
```

## Scanner Worker Contract

The scanner worker should expose these endpoints to the backend.

The worker can be written in any stack, but Python with Nmap is recommended. The important part is returning the JSON shapes below so the Node.js backend can store the results without extra translation.

### `POST /discover`

Request:

```json
{
  "subnet": "192.168.1.0/24"
}
```

Expected response:

```json
{
  "runnerJobId": "scan-job-001",
  "assets": [
    {
      "ip": "192.168.1.50",
      "mac": "AA:BB:CC:DD:EE:FF",
      "hostname": "workstation-50",
      "osType": "windows",
      "vendor": "Dell",
      "status": "active",
      "openPorts": [],
      "metadata": {
        "scanner": "nmap",
        "sourceSubnet": "192.168.1.0/24"
      }
    }
  ]
}
```

Error response recommendation:

```json
{
  "runnerJobId": "scan-job-001",
  "error": "Nmap timed out",
  "details": "Scan exceeded 60 seconds"
}
```

### `POST /scan-ports`

Request:

```json
{
  "target": "192.168.1.50",
  "ports": "1-1024",
  "type": "CONNECT"
}
```

Expected response:

```json
{
  "runnerJobId": "port-job-001",
  "asset": {
    "ip": "192.168.1.50",
    "mac": "AA:BB:CC:DD:EE:FF",
    "hostname": "workstation-50",
    "osType": "windows",
    "vendor": "Dell",
    "status": "active",
    "openPorts": [
      {
        "port": 445,
        "protocol": "tcp",
        "service": "smb",
        "banner": "Microsoft SMB",
        "state": "open"
      }
    ],
    "metadata": {
      "scanner": "nmap",
      "scanProfile": "safe_tcp_service_scan"
    }
  }
}
```

Error response recommendation:

```json
{
  "runnerJobId": "port-job-001",
  "error": "Target unreachable",
  "details": "Host did not respond to discovery or TCP connect"
}
```

## Sniffer Worker Contract

The sniffer worker should expose this endpoint to the backend.

The sniffer worker should run outside the main backend process because packet capture often needs elevated permissions and OS-specific drivers.

### `POST /sniffing/start`

Request:

```json
{
  "interfaceName": "eth0",
  "durationSec": 300,
  "filter": "ip"
}
```

Expected response:

```json
{
  "runnerJobId": "sniff-job-001",
  "status": "running",
  "packets": [
    {
      "timestamp": "2026-06-12T10:00:00.000Z",
      "interface": "eth0",
      "src_ip": "192.168.1.50",
      "dst_ip": "8.8.8.8",
      "protocol": "TCP",
      "src_port": 51515,
      "dst_port": 443,
      "flags": "SYN",
      "size": 74
    }
  ]
}
```

For live streaming, the worker can either push packet samples to the backend later, or the backend can poll the worker by `runnerJobId`. The backend already emits this Socket.IO event to the user room:

```text
network:sniffing:sample
```

Error response recommendation:

```json
{
  "runnerJobId": "sniff-job-001",
  "error": "Interface not found",
  "details": "eth0 is not available on this host"
}
```

## SIEM Deployment Integration

Current code location:

- `src/modules/uctc/uctc.controller.js`
- Function: `deployRule`

Needed from cyber/SIEM team:

- Target SIEM name.
- API base URL.
- Authentication method.
- Rule payload format.
- Field mapping for converted queries.
- External rule ID returned by the SIEM.
- Deployment status response shape.

Recommended backend result to store later:

```json
{
  "externalRuleId": "siem-rule-123",
  "deploymentTarget": "elastic",
  "deploymentStatus": "deployed",
  "deployedAt": "2026-06-12T10:00:00.000Z"
}
```

## SOAR And GRC Integration

Expected integration from the cross-team architecture document:

- LumiNet overflow or anomaly event should trigger SOAR:
  - `POST /api/v1/soar/trigger-playbook`
- LumiNet asset risk or misconfiguration should auto-log to GRC:
  - `POST /api/v1/grc/risks/auto-log`

Current backend location for anomaly output:

- `src/modules/network/network.controller.js`
- Function: `getFlowMetrics`

Current backend location for misconfiguration output:

- `src/modules/network/network.controller.js`
- Function: `getMisconfigurations`

Needed from SOAR/GRC teams:

- Endpoint URLs.
- Auth method.
- Required request body fields.
- Retry policy.
- Expected response format.

## Cyber Team Inputs Needed

- Allowed test subnets and scan targets.
- Safe scan rate limits and concurrency limits.
- Allowed Nmap flags for each environment.
- Whether UDP, SYN, OS fingerprinting, and banner grabbing are approved.
- Packet capture interfaces and capture filters.
- Packet field schema for decoded packets.
- Flow baseline and overflow/anomaly thresholds.
- Misconfiguration signature catalog with severity and recommendation text.
- Sigma rule templates for common LumiNet findings.
- SIEM field mappings for Windows, Linux, firewall, and network telemetry.
- Safe UCTC lab scenarios and scripts.

## Real Testing Readiness

Use this order when moving from mock testing to real integration testing:

1. Run backend smoke tests with mock modes.
2. Set `LUMINET_SCAN_MODE=local` and test discovery/port scans on an approved local subnet.
3. Set `UCTC_SANDBOX_MODE=docker` and test Python, Bash, and PowerShell sandbox scripts.
4. Start scanner worker, set `LUMINET_SCAN_MODE=worker`, and test `/network/discover` plus `/network/scan-ports`.
5. Start sniffer worker, set `LUMINET_SNIFFING_MODE=worker`, and test `/sniffing/start`.
6. Connect SIEM deployment API and test deploying one converted Sigma rule.
7. Connect SIEM alert feedback into UCTC tuning.
8. Connect flow anomaly output to SOAR.
9. Connect misconfiguration/risk output to GRC.

## Acceptance Criteria

Use this checklist to decide whether the backend integrations are complete enough for the final project presentation.

### LumiNet Scanner

- `LUMINET_SCAN_MODE=worker` is configured.
- `POST /api/v1/network/discover` returns real assets from the approved subnet.
- `POST /api/v1/network/scan-ports` returns real open ports for at least one test machine.
- Results are saved in MongoDB as `NetworkAsset` and `NetworkScan` documents.
- Risky services create `NetworkMisconfiguration` records.
- Scanner failures return clear backend errors without crashing the server.

### LumiNet Sniffer

- `LUMINET_SNIFFING_MODE=worker` is configured.
- `POST /api/v1/sniffing/start` creates a real sniffing session.
- Packet samples are saved in MongoDB as `SniffingSession.samplePackets`.
- The backend emits `network:sniffing:sample` for live UI consumption.
- Capture failures are stored with failed session status.

### LumiNet Flow Metrics

- Flow metrics come from real packet/flow aggregation, not seeded demo values.
- Anomaly thresholds are approved by the cyber team.
- `GET /api/v1/network/flow-metrics?anomaly_only=true` returns real anomaly candidates.
- High-risk flow anomalies are ready to trigger SOAR.

### UCTC Sandbox

- `UCTC_SANDBOX_MODE=docker` is configured on the test/cloud machine.
- Python, Bash, and PowerShell scripts run inside restricted containers.
- Timeout, memory, CPU, PID, and output limits are enforced.
- Sandbox runs are stored with status, output, error, image, and duration.

### UCTC SIEM Deployment

- One converted Sigma rule can be deployed to the chosen SIEM.
- The backend stores the external SIEM rule ID.
- Failed deployments return clear errors and do not mark the rule as deployed.
- SIEM alert feedback can be ingested into UCTC tuning.

### Cross-Tool Integrations

- `GET /api/v1/assets/context/:ip` returns useful asset context for SOC, UCTC, SOAR, and GRC.
- `POST /api/v1/rules/suggest-from-network` generates rule suggestions from a real LumiNet asset.
- LumiNet misconfigurations can be sent to GRC risk auto-log.
- LumiNet flow anomalies can trigger a SOAR playbook.

## Safety Guardrails

- Only scan approved lab/cloud subnets.
- Keep subnet host caps enabled with `LUMINET_MAX_DISCOVERY_HOSTS`.
- Keep scan concurrency controlled with `LUMINET_SCAN_CONCURRENCY`.
- Do not execute scanner commands through shell string interpolation.
- Keep UCTC sandbox containers restricted with no network, memory limits, CPU limits, PID limits, dropped capabilities, read-only filesystem, and non-root user.
- Store secrets only in `.env` or cloud secret manager.
- Keep `runnerJobId` from workers for auditability.
- Log integration failures without exposing secrets in API responses.
