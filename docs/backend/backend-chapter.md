# LumiSec Platform — Backend Architecture & Engineering Chapter

**Document Version:** 1.0  
**Classification:** Internal Engineering / Academic Defense Reference  
**Platform:** LumiSec Unified Cybersecurity Operations Platform  
**Backend Repository:** `LumiSec-Backendzz`  
**Primary Runtime:** Node.js 20 (ES Modules)  
**Last Updated:** June 2026

---

## Document Control

| Field | Value |
|-------|-------|
| Author | LumiSec Engineering Team |
| Audience | Backend engineers, security architects, thesis evaluators, DevOps |
| Scope | Backend API, workers, data layer, integrations, deployment |
| Related Artifacts | `docs/grc-openapi.json`, `docs/soar-openapi.json`, `config/.env.example` |

---

## Table of Contents

1. [Backend Overview](#1-backend-overview)
2. [System Architecture Design](#2-system-architecture-design)
3. [Technology Stack (Deep Explanation)](#3-technology-stack-deep-explanation)
4. [Backend Folder Structure](#4-backend-folder-structure)
5. [Authentication & Security System](#5-authentication--security-system)
6. [Core Modules Implementation](#6-core-modules-implementation)
7. [Database Design (MongoDB)](#7-database-design-mongodb)
8. [API Design](#8-api-design)
9. [Real-Time System Design](#9-real-time-system-design)
10. [Background Jobs & Queues](#10-background-jobs--queues)
11. [Performance & Scalability](#11-performance--scalability)
12. [Logging & Monitoring](#12-logging--monitoring)
13. [Security Design](#13-security-design)
14. [Deployment Architecture](#14-deployment-architecture)
15. [Conclusion](#15-conclusion)

---

# 1. Backend Overview

## 1.1 System Purpose

LumiSec is an enterprise-grade cybersecurity platform designed to unify security operations, governance, and response into a single operational backbone. The backend serves as the **authoritative control plane** for:

- **Security event ingestion and correlation** (SIEM-aligned workflows via Elasticsearch integration and alert normalization)
- **Automated incident response** (SOAR playbooks, connector execution, webhook ingestion)
- **Governance, Risk, and Compliance** (GRC findings, risks, controls, evidence, audit reporting)
- **Detection engineering** (UCTC Sigma rule lifecycle, SIEM conversion, tuning)
- **Human risk simulation** (Phishing campaign orchestration and behavioral analytics)
- **Network visibility** (LumiNet discovery, port scanning, sniffing, misconfiguration detection)
- **Malware and attack simulation sandboxing** (isolated script/scenario execution)
- **Threat intelligence enrichment** (OpenCTI GraphQL integration)
- **Cross-module orchestration** (service-to-service integration endpoints)

The backend is not a passive data store. It is an **active security orchestration engine** that accepts telemetry, transforms it into actionable objects (findings, incidents, alerts), triggers automated workflows, and exposes governed APIs for analyst and compliance workflows.

## 1.2 Architecture Philosophy

LumiSec backend engineering follows five foundational principles:

### 1.2.1 Modular Monolith with Clear Domain Boundaries

All platform capabilities are implemented within a single deployable Node.js application, but each security domain (GRC, SOAR, UCTC, Phishing, LumiNet) is isolated into its own module with dedicated routers, controllers, services, validation schemas, and permission maps. This yields microservice-like clarity without the operational overhead of distributed tracing, service mesh configuration, and cross-service contract versioning at early maturity stages.

### 1.2.2 Integration-First Design

Security platforms fail when modules operate in silos. LumiSec encodes **bidirectional integration contracts** between modules:

- Network misconfigurations → GRC findings
- SIEM alerts → GRC findings / SOAR incidents
- Phishing campaign outcomes → GRC risks / SOAR incidents
- UCTC detection gaps → GRC findings
- SOAR playbook actions → Firewall/EDR/SSH connectors

Each module exposes `/integrations/*` endpoints authenticated via JWT or internal API key (`x-internal-api-key`).

### 1.2.3 Async-by-Default for Heavy Workloads

Operations that are latency-tolerant (email dispatch, playbook execution, enrichment, analytics snapshots, PDF report generation, phishing risk scoring) are offloaded to **Bull queues backed by Redis**. Synchronous API handlers validate, persist state transitions, enqueue work, and return immediately with trackable job/run identifiers.

### 1.2.4 Defense in Depth at the API Layer

Every protected route passes through a layered middleware chain:

```
CORS → Body Parser → Authentication → Authorization (RBAC) → Joi Validation → Controller → Global Error Handler
```

Validation uses `stripUnknown: true` on critical contracts (e.g., Network Scan) to prevent mass-assignment and schema drift attacks.

### 1.2.5 External Engine Delegation

Compute-intensive or privileged operations (Nmap scanning, packet capture, Docker sandbox execution, optional Python Connector Engine) are delegated to **isolated worker services** via HTTP, keeping the API process unprivileged and horizontally scalable.

## 1.3 Microservices vs Monolith — Decision Rationale

| Criterion | Microservices | LumiSec Modular Monolith (Chosen) |
|-----------|---------------|-----------------------------------|
| Team size | Requires platform/SRE maturity | Suitable for focused engineering team |
| Deployment complexity | N services, N pipelines | Single Docker image + worker replicas |
| Cross-module transactions | Distributed sagas required | MongoDB transactions (optional) + in-process calls |
| Latency | Network hops between services | In-process service calls (~μs) |
| Consistency | Eventual consistency by default | Strong consistency for incident/finding state |
| Evolution path | Already distributed | Workers + connector engine extract cleanly |

**Conclusion:** LumiSec adopts a **modular monolith** with **extractable workers**. Domain modules communicate in-process; heavy workloads and privileged scanners run as separate processes/containers. This mirrors how mature security vendors often begin — one core API with specialized execution engines — while preserving a clean extraction path toward microservices when scale demands it.

## 1.4 High-Level Backend Responsibilities

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        LumiSec Backend Responsibilities                  │
├─────────────────────────────────────────────────────────────────────────┤
│  API Gateway Layer     │ REST endpoints, validation, RBAC, rate limits  │
│  Domain Services       │ GRC, SOAR, UCTC, Phishing, LumiNet business    │
│  Integration Layer     │ ELK, OpenCTI, Fortigate, SSH, SMTP, workers    │
│  Persistence Layer     │ MongoDB (primary), PostgreSQL (GRC extensibility)│
│  Async Execution       │ Bull/Redis workers (11 worker types)             │
│  Real-Time Layer       │ Socket.IO rooms (role/user targeted events)      │
│  Observability         │ Winston structured logs, health endpoints        │
└─────────────────────────────────────────────────────────────────────────┘
```

The backend explicitly does **not** render frontend UI. It exposes JSON APIs and WebSocket events consumed by the LumiSec web dashboard (React) and optional third-party SOAR/SIEM integrations.

---

# 2. System Architecture Design

## 2.1 Full Architecture Overview

LumiSec backend architecture spans four planes: **Edge**, **Application**, **Data**, and **Execution**.

```
                                    ┌──────────────────┐
                                    │   Web Dashboard  │
                                    │  (React Frontend)│
                                    └────────┬─────────┘
                                             │ HTTPS / WSS
                                    ┌────────▼─────────┐
                                    │  Nginx Reverse     │
                                    │  Proxy + TLS       │
                                    └────────┬─────────┘
                                             │
              ┌──────────────────────────────┼──────────────────────────────┐
              │                    APPLICATION PLANE                         │
              │  ┌────────────────────────────────────────────────────────┐  │
              │  │              LumiSec API (Express.js)                  │  │
              │  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌────────────┐  │  │
              │  │  │  Auth   │ │   GRC   │ │  SOAR   │ │   UCTC     │  │  │
              │  │  └─────────┘ └─────────┘ └─────────┘ └────────────┘  │  │
              │  │  ┌─────────┐ ┌─────────────────────────────────────┐ │  │
              │  │  │Phishing │ │ LumiNet (Network Discovery/Scan)    │ │  │
              │  │  └─────────┘ └─────────────────────────────────────┘ │  │
              │  │  Socket.IO Server (real-time alerts)                   │  │
              │  └────────────────────────────────────────────────────────┘  │
              └──────────────────────────────┬──────────────────────────────┘
                                             │
         ┌───────────────────────────────────┼───────────────────────────────────┐
         │                          DATA & MESSAGING PLANE                          │
         │  ┌──────────┐  ┌──────────┐  ┌──────────────┐  ┌──────────────────┐  │
         │  │ MongoDB  │  │  Redis   │  │ Elasticsearch│  │  PostgreSQL      │  │
         │  │ (Primary)│  │Queues/Cache│ │ (SIEM Logs) │  │  (GRC extension) │  │
         │  └──────────┘  └──────────┘  └──────────────┘  └──────────────────┘  │
         └───────────────────────────────────┬───────────────────────────────────┘
                                             │
         ┌───────────────────────────────────┼───────────────────────────────────┐
         │                         EXECUTION PLANE (Workers)                      │
         │  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────────────┐ │
         │  │ Playbook   │ │  Alert     │ │ Enrichment │ │ Email / Tracking /   │ │
         │  │ Worker     │ │  Worker    │ │ Worker     │ │ Risk / Report Workers│ │
         │  └────────────┘ └────────────┘ └────────────┘ └────────────────────┘ │
         │  ┌────────────────────┐ ┌────────────────────┐ ┌───────────────────┐ │
         │  │ Scanner Worker     │ │ Sniffer Worker     │ │ Connector Engine  │ │
         │  │ (Nmap/TCP/UDP)     │ │ (Packet Capture)   │ │ (Python/FastAPI)  │ │
         │  └────────────────────┘ └────────────────────┘ └───────────────────┘ │
         │  ┌────────────────────────────────────────────────────────────────┐ │
         │  │ Docker Sandbox Runner (UCTC Lab — isolated script execution)    │ │
         │  └────────────────────────────────────────────────────────────────┘ │
         └─────────────────────────────────────────────────────────────────────┘
                                             │
         ┌───────────────────────────────────┼───────────────────────────────────┐
         │                      EXTERNAL SECURITY SYSTEMS                         │
         │  OpenCTI │ Fortigate │ Wazuh │ CrowdStrike │ Splunk │ Defender │ SMTP  │
         └─────────────────────────────────────────────────────────────────────┘
```

## 2.2 Data Flow Explanation

### 2.2.1 Inbound Telemetry Flow (SIEM / Webhook)

```
External SIEM/EDR → POST /api/soar/webhooks/{source}
                  → Validation (Joi) + Auth (JWT/RBAC)
                  → SoarAlert document created
                  → alertQueue.add("processSoarAlert")
                  → alertWorker: optional Incident auto-creation
                  → emitAlert("soc_analyst", "incident:created")
                  → Frontend receives WebSocket event
```

### 2.2.2 GRC Finding Ingestion Flow (Cross-Module)

```
LumiNet scan detects telnet → integrateGrcFinding()
                            → POST /api/grc/integrations/network/findings
                            → Finding created (sourceModule: network)
                            → Risk scoring job enqueued (riskWorker)
                            → Notification persisted
                            → AuditLog entry written
```

### 2.2.3 Playbook Automation Flow

```
Analyst → POST /api/soar/incidents/:id/playbooks/run
        → PlaybookRun + PlaybookRunSteps created (status: queued)
        → soarQueue.add("executePlaybookRun", { attempts: 3, backoff: exponential })
        → playbookWorker executes actions sequentially:
            block_ip → Fortigate API
            enrich → OpenCTI GraphQL
            isolate_host → SSH/WinRM
            notify → SMTP
        → Step status persisted per action
        → emitAlert on completion/failure
```

### 2.2.4 Phishing Campaign Flow

```
Manager → POST /api/phishing/campaigns/:id/launch
        → Campaign status: running
        → emailQueue: per-recipient SMTP jobs
        → Recipient tracking URLs generated
        → Public tracking endpoints (rate-limited):
            GET  /track/open/:trackingId
            GET  /track/click/:trackingId
            POST /track/submit/:trackingId
        → PhishingEvent documents persisted
        → riskQueue: department/user risk scoring
        → Optional SOAR/GRC integration on credential submission
```

## 2.3 Communication Between Modules

LumiSec modules communicate through three mechanisms:

| Mechanism | Use Case | Example |
|-----------|----------|---------|
| **In-process service calls** | Same-request orchestration | Controller calls `upsertNetworkAsset()` |
| **HTTP integration endpoints** | Cross-module bounded context | SOAR → GRC finding promotion |
| **Shared Redis queues** | Async fan-out | Alert processing, playbook execution |

Module integration matrix:

```
         ┌───────┬───────┬──────┬─────────┬────────┬────────┐
         │  GRC  │ SOAR  │ UCTC │Phishing │LumiNet │ OpenCTI│
    ┌────┴───────┴───────┴──────┴─────────┴────────┴────────┤
GRC │  —   │ incidents│ gaps │  risks  │findings│   IOCs   │
SOAR│findings│  —    │rules │campaigns│block-ip│  enrich  │
UCTC│  gaps │incident│  —   │    —    │coverage│   IOCs   │
Phish│ risks │incident│  —   │    —    │   —    │indicator │
Net │findings│incident│ gaps │    —    │   —    │ enrich   │
    └────────────────────────────────────────────────────────┘
```

## 2.4 Synchronous vs Asynchronous Operations

| Operation | Mode | Rationale |
|-----------|------|-----------|
| User login/signup | Sync | Immediate token required |
| CRUD on findings/incidents | Sync | Analyst expects instant feedback |
| Network port scan (local mode) | Sync | Results needed in same session |
| Network discovery (large CIDR) | Sync* | *May delegate to worker in cloud mode |
| Playbook execution | Async | Multi-step, external API latency |
| Phishing email dispatch | Async | Bulk SMTP, deliverability retries |
| PDF report generation | Async | CPU-bound, large documents |
| Artifact enrichment (OpenCTI) | Async | External GraphQL latency |
| Analytics snapshot export | Async | Aggregation + file write |
| SIEM alert → incident | Async | Decouples webhook ACK from processing |

**Design rule:** Synchronous endpoints must complete within **< 5 seconds P95** for analyst workflows. Anything exceeding this threshold is enqueued with a trackable `runId`, `task_id`, or `jobId`.

---

# 3. Technology Stack (Deep Explanation)

## 3.1 Node.js (Runtime)

**Why chosen:** Node.js provides a single-language stack (JavaScript/ES Modules) across API and workers, excellent I/O concurrency for webhook-heavy security workloads, and mature ecosystem for JWT, MongoDB, Redis, and WebSocket libraries.

**How used in LumiSec:**
- ES Module (`"type": "module"`) entry at `index.js`
- HTTP server wraps Express + Socket.IO
- Worker processes are separate Node entry points (`src/workers/*.js`)
- Child process spawning for Docker sandbox and ICMP/TCP probes

**Performance benefits:**
- Non-blocking I/O handles thousands of concurrent webhook connections
- Shared code between API and workers (playbook engine, integrations)
- Native `node --test` for API integration testing without Jest overhead

## 3.2 Express.js (HTTP Framework)

**Why chosen:** Minimal, battle-tested, extensive middleware ecosystem, predictable request lifecycle for security auditing.

**How used in LumiSec:**
- Modular routers mounted in `src/bootstrap.js`
- Middleware chain: CORS → JSON parser → auth → RBAC → Joi validation → `asyncHandler` wrapper
- Centralized `globalErrorHandling` prevents stack trace leakage in production
- `asyncHandler` converts rejected promises to `next(error)` for consistent error responses

**Performance benefits:**
- Lightweight routing overhead (~sub-millisecond per request)
- Per-router middleware scoping reduces unnecessary auth checks on public tracking endpoints

## 3.3 MongoDB + Mongoose (Primary Database)

**Why chosen:** Security operations data is document-oriented — incidents contain variable enrichment payloads, playbooks store graph structures, findings carry heterogeneous metadata. MongoDB's flexible schema accelerates iteration while supporting strict validation at the application layer.

**How used in LumiSec:**
- 40+ Mongoose models in `database/models/`
- Compound indexes on query-heavy fields (`status + severity + createdAt`)
- Partial unique indexes (e.g., findings by `sourceModule + sourceId`)
- Soft-delete patterns via `deletedAt` + pre-find hooks
- Pre-save hooks for computed fields (risk score = likelihood × impact)
- Conditional validators (e.g., `ports` required only for `PORT_SCAN` type)

**Performance benefits:**
- Index-covered queries for dashboard aggregations
- Horizontal scaling via MongoDB replica sets
- Aggregation pipelines for heatmaps and compliance rollups (see Section 7)

## 3.4 Redis (Caching, Rate Limiting, Queues)

**Why chosen:** In-memory speed for job broker backing store, session-adjacent caching, and distributed rate limit counters.

**How used in LumiSec:**
- **Bull queues** (`src/utils/queue.js`) with prefix `lumisec.*`
- 10 named queues: email, soar, enrichment, alert, notification, analytics, integration, rule, report, tracking, risk
- `ioredis` client with test-mode stub for CI
- In-memory rate limiting for public phishing tracking endpoints (production may migrate to Redis-backed limiter)

**Performance benefits:**
- Decouples API response time from worker execution duration
- Exponential backoff retry on playbook jobs (3 attempts, 2s base delay)
- Queue concurrency controls (`concurrency: 1` for playbooks prevents race conditions)

## 3.5 Elasticsearch (Log Analysis + SIEM)

**Why chosen:** Industry-standard for security log storage, full-text search, and time-series alert indices.

**How used in LumiSec:**
- `@elastic/elasticsearch` client in `src/integrations/elk.js`
- `searchLogs()` — generic query interface against `logs-*` indices
- `getRecentAlerts()` — time-windowed alert retrieval from `alerts-*`
- `indexDocument()` — write-back for correlation results
- GRC integration endpoint: `POST /api/grc/integrations/siem/alerts`

**Performance benefits:**
- Offloads log storage from MongoDB (hot operational data vs cold log archive)
- Sub-second search across millions of events
- Native time-range filtering for SOC dashboards

## 3.6 Bull (Background Jobs)

**Why chosen:** Mature Redis-backed queue for Node.js with retry, backoff, concurrency, and job persistence. LumiSec uses **Bull** (v4); BullMQ is API-compatible for future migration.

**How used in LumiSec:**
- Each worker file calls `queue.process(jobName, concurrency, handler)`
- Job producers in controllers/services call `queue.add(name, payload, opts)`
- Docker Compose defines 10 worker service replicas sharing the API image

**Performance benefits:**
- At-least-once delivery with configurable retries
- Failed jobs remain inspectable in Redis for operational debugging
- Independent worker scaling per queue bottleneck

## 3.7 JWT Authentication

**Why chosen:** Stateless, horizontally scalable, standard for SPA frontends.

**How used in LumiSec:**
- `jsonwebtoken` — `generateToken({ _id, role })`, `verifyToken(token)`
- Default expiry: `JWT_EXPIRES_IN=1h` (configurable)
- Bearer token in `Authorization` header
- Socket.IO handshake auth via `socket.handshake.auth.token`

**Performance benefits:**
- No server-side session store lookup on every request (user re-fetched from MongoDB for freshness)
- Token payload minimal (user ID + role only)

## 3.8 bcrypt (Password Hashing)

**Why chosen:** Adaptive cost factor resistant to GPU brute-force attacks.

**How used in LumiSec:**
- `bcrypt.hash(password, 12)` on signup
- `bcrypt.compare(password, user.password)` on login
- Password field excluded from `select("-password")` queries

**Performance benefits:**
- Cost factor 12 balances security (~250ms/hash) with acceptable login latency

## 3.9 Docker & Deployment Tooling

**Why chosen:** Reproducible environments, worker isolation, sandbox execution boundary.

**How used in LumiSec:**
- `Dockerfile`: Node 20 Alpine, `npm ci --omit=dev`, exposes port 3000
- `docker-compose.yml`: API + MongoDB + Redis + 10 worker services
- UCTC sandbox: `docker run --rm --network none` with memory/CPU/PID limits
- Volume mounts for `uploads/` (evidence, reports, analytics exports)

**Performance benefits:**
- Worker horizontal scaling via `docker compose up --scale playbook-worker=3`
- Sandbox resource limits protect host from malicious analyst scripts

## 3.10 Additional Technologies

| Technology | Role |
|------------|------|
| **Socket.IO** | Real-time incident/alert push to dashboard |
| **Joi** | Request validation with `stripUnknown` sanitization |
| **Winston** | Structured JSON logging to console + files |
| **Nodemailer** | Phishing simulation + SOAR notification emails |
| **PDFKit** | GRC audit report PDF generation |
| **axios + axios-retry** | External worker/connector HTTP calls with retries |
| **graphql-request** | OpenCTI threat intelligence queries |
| **node-ssh** | Linux host isolation playbook actions |
| **Multer** | GRC evidence file uploads |
| **cors** | Frontend origin allowlisting |

---

# 4. Backend Folder Structure

## 4.1 Complete Project Tree

```
LumiSec-Backendzz/
├── index.js                          # Application entry: HTTP server + Socket.IO + DB connect
├── package.json                      # Dependencies, npm scripts, worker commands
├── Dockerfile                        # Production container image
├── docker-compose.yml                # API + MongoDB + Redis + 10 workers
├── config/
│   └── .env.example                  # Environment variable reference (60+ keys)
├── database/
│   ├── connection.js                 # Mongoose connection with retry logic
│   ├── index.js                      # Barrel export of all models
│   ├── models/                       # 40+ Mongoose schemas
│   │   ├── user.model.js
│   │   ├── incident.model.js
│   │   ├── playbook.model.js
│   │   ├── finding.model.js
│   │   ├── risk.model.js
│   │   ├── siemAlert.model.js
│   │   ├── sandboxRun.model.js
│   │   ├── networkScan.model.js
│   │   └── ...
│   └── seeds/                        # Framework + SOAR seed data
├── docs/
│   ├── grc-openapi.json
│   ├── soar-openapi.json
│   └── backend/
│       └── backend-chapter.md        # This document
├── src/
│   ├── app.js                        # Express app factory
│   ├── bootstrap.js                  # Route mounting + middleware registration
│   ├── middleware/
│   │   ├── authentication.js         # JWT Bearer validation
│   │   ├── authorization.js          # RBAC role gate
│   │   ├── serviceAuth.js            # Internal API key auth
│   │   ├── validation.js             # Joi wrapper (stripUnknown)
│   │   ├── cors.js                   # CORS + preflight handling
│   │   ├── rateLimit.js              # In-memory sliding window limiter
│   │   ├── upload.js                 # Multer evidence upload config
│   │   ├── asyncHandler.js           # Promise → next(error) bridge
│   │   └── globalErrorHandling.js    # Centralized error JSON response
│   ├── modules/
│   │   ├── index.js                  # Router barrel exports
│   │   ├── auth/                     # Signup, login, profile
│   │   ├── grc/                      # Findings, risks, compliance, reports
│   │   ├── soar/                     # Incidents, playbooks, connectors, webhooks
│   │   │   ├── engine/               # Playbook run state machine
│   │   │   ├── services/             # Domain services + connector engine client
│   │   │   └── helpers/              # Vault encryption utilities
│   │   ├── uctc/                     # Sigma rules, sandbox lab, tuning
│   │   ├── phishing/                 # Campaigns, templates, tracking
│   │   └── network/                  # LumiNet discovery, scan, sniffing
│   ├── integrations/
│   │   ├── elk.js                    # Elasticsearch client
│   │   ├── opencti.js                # Threat intel GraphQL
│   │   ├── mailer.js                 # SMTP
│   │   ├── firewall.js               # Fortigate API
│   │   ├── ssh.js                    # Linux command execution
│   │   └── winrm.js                  # Windows isolation
│   ├── workers/                      # Bull queue consumers (10 workers)
│   ├── utils/
│   │   ├── queue.js                  # Bull queue definitions
│   │   ├── socket.js                 # Socket.IO init + emitAlert()
│   │   ├── token.js                  # JWT sign/verify
│   │   ├── logger.js                 # Winston config
│   │   ├── apiResponse.js            # Standard JSON envelopes
│   │   ├── pagination.js             # List endpoint helpers
│   │   ├── auditLogger.js            # GRC audit trail writer
│   │   ├── transaction.js            # MongoDB transaction wrapper
│   │   ├── constant/
│   │   │   ├── enums.js              # Platform-wide enumerations
│   │   │   └── messages.js           # User-facing error messages
│   │   └── helpers/
│   │       ├── networkRunner.js      # Discovery + port scan orchestration
│   │       ├── networkPortUtils.js   # Port normalization
│   │       ├── sandboxRunner.js      # Docker-isolated script execution
│   │       └── networkFlowMetrics.js # Traffic anomaly aggregation
│   └── appError.js
├── test/                             # node:test + supertest integration tests
├── scripts/
│   └── generate-postman-collection.mjs
└── uploads/                          # Evidence, reports, analytics exports
```

## 4.2 Folder Responsibilities (Detailed)

### `src/modules/`

Each module follows a **consistent internal layout**:

| Subfolder | Responsibility |
|-----------|----------------|
| `*.router.js` | Express route definitions, middleware chain per endpoint |
| `*.controller.js` | HTTP handlers — thin orchestration, no business logic |
| `*.validation.js` | Joi schemas — input contracts, sanitization |
| `permissions.js` | RBAC matrix mapping roles → allowed operations |
| `services/` | Business logic, database operations, queue producers |

This convention ensures any engineer can navigate an unfamiliar module within minutes.

### `src/middleware/`

Cross-cutting concerns extracted from controllers:

- **authentication.js** — Validates JWT, loads `req.authUser`, blocks suspended accounts, bypasses OPTIONS preflight
- **authorization.js** — Role array check against `req.authUser.role`
- **serviceAuth.js** — Dual-mode auth: `x-internal-api-key` OR JWT for integration endpoints
- **validation.js** — Runs Joi, replaces `req.body`/`req.query`/`req.params` with sanitized values

### `src/workers/`

Independent Node processes consuming Bull queues:

| Worker File | Queue | Job Types |
|-------------|-------|-----------|
| `emailWorker.js` | `phishing.email` | Campaign email dispatch |
| `trackingWorker.js` | `phishing.tracking` | Async event persistence |
| `riskWorker.js` | `phishing.risk` | Department risk scoring |
| `reportWorker.js` | `report` | PDF report generation |
| `playbookWorker.js` | `soar.legacy` | Playbook step execution |
| `enrichmentWorker.js` | `soar.enrichment` | OpenCTI artifact enrichment |
| `alertWorker.js` | `soar.alert` | Webhook alert → incident |
| `notificationWorker.js` | `soar.notification` | Analyst notifications |
| `analyticsWorker.js` | `soar.analytics` | KPI snapshot computation |
| `integrationWorker.js` | `soar.integration` | Cross-module action execution |
| `ruleWorker.js` | `uctc.rule` | Sigma rule conversion/deploy |

### `src/integrations/`

Thin adapters isolating third-party API details from domain services. If Fortigate API changes, only `firewall.js` requires modification.

### `database/models/`

Mongoose schemas with:
- Enum constraints from `enums.js`
- Compound indexes declared at schema level
- `ref` population paths for cross-collection joins
- Pre-save/pre-find middleware for computed fields and soft deletes

---

# 5. Authentication & Security System

## 5.1 JWT Access Token Design

LumiSec implements **stateless JWT authentication** for API and WebSocket connections.

### Token Structure

```json
{
  "header": { "alg": "HS256", "typ": "JWT" },
  "payload": {
    "_id": "665f1a2b3c4d5e6f7a8b9c0d",
    "role": "soc_analyst",
    "iat": 1718640000,
    "exp": 1718643600
  }
}
```

### Token Lifecycle

```
┌──────────┐    POST /api/auth/login     ┌──────────────┐
│  Client  │ ──────────────────────────► │   Auth API   │
│          │    { email, password }      │              │
│          │ ◄────────────────────────── │ bcrypt.compare│
│          │    { token, user }          │ generateToken │
└──────────┘                             └──────────────┘
      │
      │  Authorization: Bearer <token>
      ▼
┌──────────────┐    verifyToken()    ┌──────────────┐
│  Protected   │ ──────────────────► │ User.findById │
│  Endpoint    │                     │ status check  │
└──────────────┘                     └──────────────┘
```

**Configuration:**
- `JWT_SECRET` — HMAC signing key (must be ≥ 256 bits in production)
- `JWT_EXPIRES_IN` — Default `1h`

> **Note:** Refresh token rotation is architected as a forward-compatible extension. Current implementation uses single access tokens; production hardening should add `refreshToken` collection with rotation on use and revocation support.

## 5.2 Role-Based Access Control (RBAC)

### Platform Roles

| Role | Primary Domain |
|------|----------------|
| `admin` | Full platform access |
| `soc_analyst` | Incident triage, sniffing, rule reading |
| `soc_manager` | Incident management, rule approval, dashboards |
| `detection_engineer` | UCTC rules, network scanning, tuning |
| `red_team` | Sandbox lab execution |
| `auditor` | GRC read-only audit access |
| `compliance_manager` | Controls, compliance status |
| `grc_manager` | Findings, risks, reports |
| `it_manager` | Network discovery and scanning |
| `phishing_operator` | Campaign operations |
| `phishing_manager` | Campaign management + reports |
| `integration_admin` | Service-to-service integrations |
| `read_only` | Dashboard viewing only |

### RBAC Implementation Pattern

Each module defines a `permissions.js` map:

```javascript
// Pattern (simplified)
export const soarPermissions = {
  incidents: {
    create: [roles.ADMIN, roles.SOC_ANALYST, roles.SOC_MANAGER],
    read:   [roles.ADMIN, roles.SOC_ANALYST, roles.SOC_MANAGER, roles.READ_ONLY],
    update: [roles.ADMIN, roles.SOC_MANAGER],
    delete: [roles.ADMIN],
  },
  // ...
};
```

Routes apply: `isAuthenticated()` → `isAuthorized(p.incidents.create)` → handler.

### RBAC Flow Diagram

```
Request ──► isAuthenticated() ──► 401 if no/invalid token
                │
                ▼
         isAuthorized([roles]) ──► 403 if role not in allowedRoles
                │
                ▼
            Controller
```

## 5.3 Multi-Factor Authentication (MFA) — Design Specification

While the current codebase implements password + JWT, the platform architecture reserves MFA integration at the authentication layer:

```
┌─────────────────────────────────────────────────────────┐
│                  MFA Flow (Target State)                 │
├─────────────────────────────────────────────────────────┤
│  1. POST /api/auth/login → credentials validated       │
│  2. If MFA enabled → return { mfaRequired: true,       │
│       mfaToken: <temporary_challenge_token> }           │
│  3. POST /api/auth/mfa/verify → TOTP/WebAuthn validation│
│  4. Return full access JWT + refresh token              │
└─────────────────────────────────────────────────────────┘
```

**Recommended implementation:**
- TOTP (RFC 6238) via `speakeasy` — compatible with Google Authenticator
- Backup codes stored bcrypt-hashed
- MFA secret encrypted at rest (AES-256-GCM with KMS-managed key)
- Role policy: `admin`, `soc_manager`, `integration_admin` — MFA mandatory

## 5.4 Email Verification Flow (Design)

```
Signup → User created (status: inactive)
       → verificationToken (JWT, 24h expiry) emailed
       → GET /api/auth/verify?token=...
       → status: active
       → login permitted
```

Prevents credential stuffing on unverified accounts and ensures audit trail integrity for compliance modules.

## 5.5 Password Hashing Strategy

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| Algorithm | bcrypt | Industry standard, adaptive cost |
| Salt rounds | 12 | ~250ms/hash, OWASP recommended range |
| Storage | `user.password` field | Never returned in API responses |
| Comparison | `bcrypt.compare()` | Timing-safe comparison built-in |

**Password policy (validation layer recommendation):**
- Minimum 12 characters
- At least one uppercase, lowercase, digit, special character
- Checked via Joi in `signupValidation`

## 5.6 Rate Limiting

### Public Endpoint Protection

Phishing tracking endpoints apply `rateLimit({ windowMs: 60_000, max: 120 })`:

```
GET  /api/phishing/track/open/:trackingId
GET  /api/phishing/track/click/:trackingId
POST /api/phishing/track/submit/:trackingId
```

Response headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`  
Exceeded: `429 Too Many Requests`

### Production Recommendation

Migrate in-memory `Map` buckets to **Redis-backed sliding window** for multi-instance API deployments.

## 5.7 Security Headers (Nginx Layer)

Recommended Nginx configuration for production:

```nginx
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
add_header Content-Security-Policy "default-src 'self'" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
```

## 5.8 Session Management

| Aspect | Implementation |
|--------|----------------|
| Session store | None (stateless JWT) |
| Token invalidation | Short expiry (1h); future: token blacklist in Redis |
| Concurrent sessions | Unlimited; future: `user.sessions[]` tracking |
| Socket.IO auth | JWT in `handshake.auth.token` |
| Service accounts | `x-internal-api-key` → synthetic `INTEGRATION_ADMIN` user |

## 5.9 Service-to-Service Authentication

Internal integrations use a shared secret:

```
Header: x-internal-api-key: <INTERNAL_API_KEY>
Middleware: isServiceOrUserAuthenticated()
```

This allows GRC to call SOAR endpoints without a human JWT while preserving RBAC checks downstream.

---

# 6. Core Modules Implementation

## 6.1 GRC Module

**Base path:** `/api/grc`  
**Purpose:** Governance, Risk, and Compliance lifecycle management.

### 6.1.1 Risk Management Logic

Risks are computed from **likelihood (1–5) × impact (1–5)**:

| Score Range | Risk Level |
|-------------|------------|
| 1–4 | Low |
| 5–9 | Medium |
| 10–14 | High |
| 15–25 | Critical |

Pre-save hook in `risk.model.js` auto-calculates `score` and `riskLevel`. Treatment options: `mitigate`, `accept`, `transfer`, `avoid`.

**Risk lifecycle:**
```
OPEN → MITIGATED (mitigateRisk) → CLOSED
OPEN → ACCEPTED (acceptRisk) → CLOSED
```

### 6.1.2 Controls Mapping

Compliance controls (`ComplianceControl` model) map to framework requirements via `RequirementControlMapping`:

```
Framework (ISO27001, NIST, PCI_DSS, SOC2)
  └── FrameworkRequirement
        └── RequirementControlMapping
              └── UnifiedControl / ComplianceControl
                    └── linked Finding(s)
```

`GET /api/grc/compliance/status` aggregates control compliance percentages per framework.

### 6.1.3 Compliance Frameworks

Supported frameworks (enum `complianceFramework`):
- ISO 27001
- NIST CSF
- PCI DSS
- SOC 2

Framework seed data loaded via `npm run seed:frameworks`.

### 6.1.4 Finding Lifecycle

```
OPEN → IN_PROGRESS → READY_FOR_RETEST → PENDING_VALIDATION → RESOLVED → CLOSED
                  ↘ REOPENED (from CLOSED)
```

Findings ingested from external modules carry `sourceModule` + `sourceId` with a **partial unique index** preventing duplicate ingestion.

### 6.1.5 Key Services

| Service | Responsibility |
|---------|----------------|
| `risk.service.js` | CRUD, accept/mitigate/close transitions |
| `compliance.service.js` | Control management, finding linkage |
| `evidence.service.js` | File upload, metadata, chain of custody |
| `report.service.js` | Audit report assembly + PDF generation |
| `audit.service.js` | Immutable audit log queries |
| `frameworkImporter.service.js` | Bulk framework requirement import |

---

## 6.2 SIEM Module

LumiSec does not operate a standalone `/api/siem` router. SIEM capabilities are **distributed across integration points**:

### 6.2.1 Log Ingestion Pipeline

```
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐
│ Log Sources │ ──► │ Elasticsearch│ ──► │ elk.js adapter  │
│ (Beats/     │     │ logs-* index │     │ searchLogs()    │
│  Agents)    │     └──────────────┘     └────────┬────────┘
└─────────────┘                                    │
                                                   ▼
                                          ┌─────────────────┐
                                          │ GRC/SOAR/UCTC   │
                                          │ integration     │
                                          │ endpoints       │
                                          └─────────────────┘
```

### 6.2.2 Correlation Engine

Correlation occurs at two levels:

1. **Elasticsearch queries** — Time-windowed, field-based correlation (`getRecentAlerts(minutes)`)
2. **Application-level** — SOAR webhook ingestion creates `SoarAlert` → `alertWorker` correlates to existing incidents or creates new ones

### 6.2.3 Alert Generation Logic

```
SIEM alert webhook → POST /api/soar/webhooks/{source}
                   → SoarAlert.create({ source, severity, rawPayload })
                   → alertQueue.add("processSoarAlert")
                   → Worker evaluates: createIncident?
                   → Incident.create() if no existing link
                   → emitAlert("soc_analyst", "incident:created")
```

GRC-side SIEM ingestion:

```
POST /api/grc/integrations/siem/alerts
→ SiemAlert.create({ alertId, ruleName, severity, sourceIp })
→ Optional Finding creation with severity mapping
```

### 6.2.4 UCTC SIEM Deployment

```
POST /api/uctc/integrations/siem/deploy
→ Converts validated Sigma rule to target SIEM format
→ SIEM_DEPLOYMENT_MODE=mock|elastic|splunk
→ Updates rule status: deployed
```

---

## 6.3 SOAR Module

**Base path:** `/api/soar`  
**Purpose:** Security Orchestration, Automation, and Response.

### 6.3.1 Playbook Execution Engine

Located in `src/modules/soar/engine/playbookEngine.js`:

```
createRun() → PlaybookRun (queued) + PlaybookRunStep[] (pending)
queueRun()  → soarQueue.add("executePlaybookRun")
playbookWorker:
  for each action in playbook.actions:
    evaluateCondition(condition, context)
    executeAction(type, params)
    update PlaybookRunStep status
    on failure: nextOnFailure branch
    on success: nextOnSuccess branch
```

**Supported action types:**

| Action Type | Integration |
|-------------|-------------|
| `block_ip` | Fortigate API |
| `enrich` | OpenCTI GraphQL |
| `isolate_host` | SSH (Linux) / WinRM (Windows) |
| `notify` | SMTP email |
| `ssh_command` | Remote command execution |

### 6.3.2 Automation Workflows

**Manual trigger:**
```
POST /api/soar/incidents/:id/playbooks/run
{ "playbookId": "...", "context": { "sourceIP": "10.0.0.5" } }
```

**Webhook auto-trigger (future):**
Playbooks with `triggerType: "auto"` and `triggerCondition` expression evaluated on alert ingestion.

### 6.3.3 Connector Architecture

```
┌─────────────────────────────────────────────────────┐
│              SOAR Connector Subsystem                │
├─────────────────────────────────────────────────────┤
│  connectorDiscoveryService  → list available actions │
│  connectorExecutionService  → execute action         │
│  connectorHealthService     → probe connectivity     │
│  connectorEngineClient      → optional Python engine │
│                                                      │
│  Mode: SOAR_CONNECTOR_MODE=local|engine              │
└─────────────────────────────────────────────────────┘
```

### 6.3.4 Webhook Ingestion Sources

| Endpoint | Source |
|----------|--------|
| `/webhooks/crowdstrike` | CrowdStrike EDR |
| `/webhooks/fortigate` | Fortigate firewall |
| `/webhooks/wazuh` | Wazuh SIEM |
| `/webhooks/defender` | Microsoft Defender |
| `/webhooks/splunk` | Splunk SIEM |
| `/webhooks/custom` | Generic normalizer |

### 6.3.5 Credential Vault

Sensitive connector credentials stored encrypted via `vaultCrypto.js` (AES-256). Vault entries referenced by connectors at execution time — never returned in API list responses.

---

## 6.4 Sandbox Module (UCTC Lab)

**Base path:** `/api/uctc/lab/*`  
**Purpose:** Isolated malware/attack simulation script execution.

### 6.4.1 Malware Execution Isolation

```
┌──────────────────────────────────────────────────────────┐
│                  Sandbox Isolation Boundary               │
├──────────────────────────────────────────────────────────┤
│  UCTC_SANDBOX_MODE=mock  → Safe simulated output         │
│  UCTC_SANDBOX_MODE=docker → Real isolated execution      │
│                                                          │
│  Docker constraints:                                     │
│    --network none          (no egress)                   │
│    --memory 512m           (memory limit)                │
│    --cpus 1                (CPU limit)                   │
│    --pids-limit 128        (fork bomb protection)        │
│    --user 1000:1000        (non-root)                    │
│    read-only bind mount    (script injection prevention) │
└──────────────────────────────────────────────────────────┘
```

### 6.4.2 Static + Dynamic Analysis Pipeline

| Phase | Description |
|-------|-------------|
| **Submission** | `POST /api/uctc/lab/execute-script` or `execute-scenario` |
| **Validation** | Joi schema: language (powershell/python/bash), script body, timeout |
| **Queuing** | `SandboxRun` document created (status: queued) |
| **Execution** | `sandboxRunner.js` spawns Docker container or mock runner |
| **Output capture** | stdout/stderr truncated to `UCTC_MAX_OUTPUT_BYTES` |
| **Persistence** | `SandboxRun` updated: exitCode, durationMs, output, error |
| **Audit** | `GET /api/uctc/lab/runs` — full execution history |

### 6.4.3 Built-in Scenarios

`GET /api/uctc/scenarios/list` returns safe pre-built attack simulations (credential dumping patterns, lateral movement indicators) without exposing script bodies to unauthorized roles.

### 6.4.4 Report Generation

Sandbox run results feed UCTC dashboard stats and can trigger GRC findings when scenarios detect control failures.

---

## 6.5 Threat Intelligence Module

Implemented via **OpenCTI integration** (`src/integrations/opencti.js`) and artifact enrichment services.

### 6.5.1 IOC Ingestion

```
POST /api/grc/integrations/opencti/ioc
POST /api/uctc/integrations/opencti/ioc
POST /api/phishing/integrations/opencti/indicator
POST /api/luminet/integrations/opencti/enrichment
```

Each endpoint normalizes IOCs into the appropriate domain model (Finding, Sigma rule context, campaign indicator, asset enrichment).

### 6.5.2 Enrichment Logic

```
POST /api/soar/artifacts/:id/enrich
→ enrichmentQueue.add({ artifactId })
→ enrichmentWorker:
    switch(artifact.type):
      IP → opencti.enrichIP(value)
      DOMAIN → opencti GraphQL lookup
      HASH → threat intel pattern match
→ ArtifactEnrichment.create({ scores, indicators, raw })
```

### 6.5.3 Reputation Scoring

OpenCTI returns indicator `confidence` (0–100). LumiSec maps to platform severity:

| OpenCTI Confidence | LumiSec Severity |
|--------------------|------------------|
| 0–30 | Low |
| 31–60 | Medium |
| 61–85 | High |
| 86–100 | Critical |

---

## 6.6 Incident Management

**Base path:** `/api/soar/incidents`  
**Purpose:** Full incident lifecycle within SOAR module.

### 6.6.1 Incident Lifecycle

```
NEW → OPEN → IN_PROGRESS → ESCALATED → RESOLVED → CLOSED
                              ↓
                        FALSE_POSITIVE
```

### 6.6.2 Incident Data Model

Key fields: `title`, `severity`, `status`, `sourceIP`, `affectedHost`, `assignedTo`, `tags`, `relatedIncidents[]`, `enrichment` (OpenCTI results).

Soft delete via `deletedAt` — pre-find hook excludes deleted incidents by default.

### 6.6.3 Response Workflow

```
1. Alert ingested → Incident auto-created (alertWorker)
2. Analyst assigned → PATCH /incidents/:id { assignedTo }
3. Artifacts collected → POST /incidents/:id/artifacts
4. Enrichment run → POST /artifacts/:id/enrich
5. Playbook executed → POST /incidents/:id/playbooks/run
6. Notes added → POST /incidents/:id/notes
7. Related incidents linked → POST /incidents/:id/related
8. Incident closed → PATCH /incidents/:id/close
```

### 6.6.4 Timeline

`GET /api/soar/incidents/:id/timeline` aggregates:
- Status changes
- Playbook run events
- Notes
- Artifact additions
- Integration actions

---

## 6.7 Additional Modules

### 6.7.1 Phishing Simulation (`/api/phishing`)

Campaign lifecycle: `draft → scheduled → running → paused/completed/cancelled`

Tracks: `email_sent → opened → clicked → form_visited → credential_submitted`

### 6.7.2 LumiNet Network (`/api/luminet`)

| Capability | Endpoint |
|------------|----------|
| Subnet discovery | `POST /network/discover` |
| Port scanning | `POST /network/scan-ports` |
| Packet sniffing | `POST /sniffing/start` |
| Asset inventory | `GET /assets/inventory` |
| Misconfigurations | `GET /network/misconfigurations` |
| Flow metrics | `GET /network/flow-metrics` |

**NetworkScanRequest contract:**
```json
{
  "target": "10.0.0.25",
  "ports": [22, 80, 443],
  "scanMode": "CONNECT"
}
```

### 6.7.3 UCTC Detection Engineering (`/api/uctc`)

Sigma rule lifecycle: `draft → validated → converted → testing → deployed → retired`

Supports conversion to Elastic, Splunk, and Sentinel query formats.

---

# 7. Database Design (MongoDB)

## 7.1 Collections Overview

LumiSec persists 40+ MongoDB collections. Core collections:

| Collection | Purpose | Key Relationships |
|------------|---------|-------------------|
| `users` | Authentication, RBAC | Referenced by all `createdBy`/`assignedTo` |
| `incidents` | SOAR incident records | → artifacts, notes, playbookRuns |
| `playbooks` | Automation definitions | → playbookRuns |
| `playbookruns` | Execution instances | → playbookRunSteps |
| `artifacts` | IOCs tied to incidents | → artifactEnrichments |
| `findings` | GRC security findings | → risks, retests, evidence |
| `risks` | Risk register | → findings (optional link) |
| `compliancecontrols` | Control definitions | → requirementControlMappings |
| `siemalerts` | Normalized SIEM alerts | → findings |
| `soaralerts` | Webhook alert buffer | → incidents |
| `sandboxruns` | UCTC lab executions | → users (requestedBy) |
| `networkscans` | Discovery/scan jobs | → networkAssets |
| `networkassets` | Discovered hosts | → misconfigurations |
| `campaigns` | Phishing campaigns | → recipients, events |
| `sigmarules` | UCTC detection rules | → uctcTunings |
| `auditlogs` | Immutable audit trail | Polymorphic entity reference |
| `connectors` | SOAR integration connectors | → integrationActions |
| `credentialvaults` | Encrypted secrets | Referenced by connectors |

## 7.2 Schema Design Patterns

### 7.2.1 Soft Delete

```javascript
// incident.model.js pattern
deletedAt: { type: Date }
// Pre-find hook excludes deletedAt != null
```

### 7.2.2 Partial Unique Indexes

```javascript
// finding.model.js — prevent duplicate cross-module ingestion
findingSchema.index(
  { sourceModule: 1, sourceId: 1 },
  { unique: true, partialFilterExpression: { sourceId: { $type: "string" } } }
);
```

### 7.2.3 Computed Fields

```javascript
// risk.model.js pre-save hook
this.score = this.likelihood * this.impact;
this.riskLevel = calculateRiskLevel(this.score);
```

### 7.2.4 Conditional Validation

```javascript
// networkScan.model.js — ports required only for port scans
ports: {
  type: [Number],
  validate: {
    validator(value) {
      if (this.type !== "port_scan") return true;
      return Array.isArray(value) && value.length > 0;
    }
  }
}
```

## 7.3 Indexing Strategy

| Collection | Index | Query Pattern |
|------------|-------|---------------|
| `incidents` | `{ status: 1, severity: 1, createdAt: -1 }` | Dashboard filtering |
| `incidents` | `{ assignedTo: 1 }` | Analyst workload view |
| `findings` | `{ status: 1, severity: 1 }` | GRC dashboard |
| `findings` | `{ title: "text", description: "text" }` | Full-text search |
| `risks` | `{ status: 1, riskLevel: 1 }` | Risk heatmap |
| `networkassets` | `{ ip: 1 }` unique | Asset upsert by IP |
| `networkscans` | `{ type: 1, status: 1, createdAt: -1 }` | Scan history |
| `playbooks` | `{ name: 1 }` unique partial | Name uniqueness |
| `siemalerts` | `{ severity: 1, receivedAt: -1 }` | Recent alerts |
| `sandboxruns` | `{ createdAt: -1 }` | Lab run history |

## 7.4 Aggregation Pipeline Examples

### 7.4.1 Risk Heatmap (Likelihood × Impact Distribution)

```javascript
db.risks.aggregate([
  { $match: { status: { $in: ["open", "mitigated"] } } },
  { $group: {
      _id: { likelihood: "$likelihood", impact: "$impact" },
      count: { $sum: 1 },
      titles: { $push: "$title" }
  }},
  { $sort: { "_id.likelihood": -1, "_id.impact": -1 } }
]);
```

### 7.4.2 Compliance Status Rollup

```javascript
db.compliancecontrols.aggregate([
  { $group: {
      _id: "$framework",
      total: { $sum: 1 },
      compliant: { $sum: { $cond: [{ $eq: ["$status", "compliant"] }, 1, 0] } },
      nonCompliant: { $sum: { $cond: [{ $eq: ["$status", "non_compliant"] }, 1, 0] } }
  }},
  { $project: {
      framework: "$_id",
      complianceRate: { $multiply: [{ $divide: ["$compliant", "$total"] }, 100] },
      total: 1, compliant: 1, nonCompliant: 1
  }}
]);
```

### 7.4.3 SOAR Incident MTTR (Mean Time to Resolve)

```javascript
db.incidents.aggregate([
  { $match: { status: "closed", resolvedAt: { $exists: true } } },
  { $project: {
      resolutionHours: {
        $divide: [{ $subtract: ["$resolvedAt", "$createdAt"] }, 3600000]
      },
      severity: 1
  }},
  { $group: {
      _id: "$severity",
      avgHours: { $avg: "$resolutionHours" },
      count: { $sum: 1 }
  }}
]);
```

### 7.4.4 Phishing Campaign Click Rate

```javascript
db.recipients.aggregate([
  { $match: { campaignId: ObjectId("...") } },
  { $group: {
      _id: "$status",
      count: { $sum: 1 }
  }},
  { $group: {
      _id: null,
      total: { $sum: "$count" },
      clicked: { $sum: { $cond: [{ $eq: ["$_id", "clicked"] }, "$count", 0] } },
      submitted: { $sum: { $cond: [{ $eq: ["$_id", "submitted"] }, "$count", 0] } }
  }},
  { $project: {
      clickRate: { $multiply: [{ $divide: ["$clicked", "$total"] }, 100] },
      submitRate: { $multiply: [{ $divide: ["$submitted", "$total"] }, 100] }
  }}
]);
```

## 7.5 Performance Optimization

| Technique | Application |
|-----------|-------------|
| **Projection** | List endpoints select only required fields |
| **Pagination** | `page` + `limit` via `pagination.js` helper |
| **Lean queries** | `.lean()` for read-only dashboard aggregations |
| **Index hints** | Compound indexes match filter + sort patterns |
| **Write concern** | `w: majority` for incident state transitions (production) |
| **Connection pooling** | Mongoose default pool (max 100 connections) |
| **Transactions** | `MONGO_TRANSACTIONS=true` for multi-document GRC operations |

## 7.6 PostgreSQL Extension

`config/.env.example` defines PostgreSQL connection for GRC module extensibility. MongoDB remains the primary operational store; PostgreSQL is reserved for structured compliance reporting and future data warehouse ETL.

---

# 8. API Design

## 8.1 API Conventions

### 8.1.1 Base URLs

| Environment | Base URL |
|-------------|----------|
| Development | `http://localhost:3000` |
| Production | `https://api.lumisec.example.com` |

### 8.1.2 Standard Response Envelope

**Success:**
```json
{
  "success": true,
  "message": "Operation completed",
  "data": { }
}
```

**Paginated:**
```json
{
  "success": true,
  "message": "Results fetched",
  "pagination": { "page": 1, "limit": 20, "total": 150, "pages": 8 },
  "data": [ ]
}
```

**Error:**
```json
{
  "success": false,
  "status": "error",
  "message": "Validation failed: \"email\" is required"
}
```

### 8.1.3 Authentication Header

```
Authorization: Bearer <jwt_token>
```

Service integrations additionally accept:
```
x-internal-api-key: <INTERNAL_API_KEY>
```

### 8.1.4 HTTP Status Codes

| Code | Usage |
|------|-------|
| 200 | Successful GET/PATCH |
| 201 | Resource created |
| 401 | Missing/invalid token |
| 403 | Insufficient role permissions |
| 404 | Resource not found |
| 409 | Duplicate resource (e.g., email exists) |
| 422 | Joi validation failure |
| 429 | Rate limit exceeded |
| 500 | Unhandled server error |
| 502 | External integration failure (ELK, OpenCTI) |

---

## 8.2 Authentication API

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/signup` | Public | Register new user |
| POST | `/api/auth/login` | Public | Authenticate, receive JWT |
| GET | `/api/auth/profile` | JWT | Current user profile |
| GET | `/health` | Public | Health check |
| GET | `/api/health` | Public | Health check (alias) |

### POST `/api/auth/login`

**Request:**
```json
{
  "email": "analyst@lumisec.io",
  "password": "SecureP@ssw0rd!"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "_id": "665f1a2b3c4d5e6f7a8b9c0d",
      "name": "SOC Analyst",
      "email": "analyst@lumisec.io",
      "role": "soc_analyst"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

---

## 8.3 GRC API

| Method | Endpoint | Roles | Description |
|--------|----------|-------|-------------|
| POST | `/api/grc/findings` | grc_manager, admin | Create finding |
| GET | `/api/grc/findings` | grc_manager, auditor, admin | List findings |
| GET | `/api/grc/findings/:id` | grc_manager, auditor | Get finding detail |
| PATCH | `/api/grc/findings/:id` | grc_manager | Update finding |
| PATCH | `/api/grc/findings/:id/close` | grc_manager | Close finding |
| POST | `/api/grc/risks` | grc_manager | Create risk |
| GET | `/api/grc/risks` | grc_manager, auditor | List risks |
| PATCH | `/api/grc/risks/:id/mitigate` | grc_manager | Mitigate risk |
| POST | `/api/grc/tasks` | grc_manager, assignee | Create remediation task |
| POST | `/api/grc/evidence` | grc_manager | Upload evidence file |
| POST | `/api/grc/reports/:id/generate` | grc_manager | Generate PDF report |
| GET | `/api/grc/compliance/status` | compliance_manager | Compliance rollup |
| GET | `/api/grc/dashboard/overview` | grc_manager, auditor | Dashboard metrics |
| POST | `/api/grc/integrations/siem/alerts` | integration_admin | Ingest SIEM alert |
| POST | `/api/grc/integrations/network/findings` | integration_admin | Ingest network finding |

### POST `/api/grc/findings`

**Request:**
```json
{
  "title": "Telnet service exposed on production server",
  "description": "Port 23 open on 10.0.0.25 without business justification",
  "severity": "high",
  "riskRating": "high",
  "asset": "10.0.0.25",
  "sourceModule": "network",
  "tags": ["network", "misconfiguration"]
}
```

**Response (201):**
```json
{
  "success": true,
  "message": "Finding created",
  "data": {
    "_id": "674a1b2c3d4e5f6a7b8c9d0e",
    "title": "Telnet service exposed on production server",
    "status": "open",
    "severity": "high",
    "createdAt": "2026-06-12T10:30:00.000Z"
  }
}
```

---

## 8.4 SOAR API

| Method | Endpoint | Roles | Description |
|--------|----------|-------|-------------|
| POST | `/api/soar/incidents` | soc_analyst, soc_manager | Create incident |
| GET | `/api/soar/incidents` | soc_analyst, soc_manager | List incidents |
| GET | `/api/soar/incidents/:id` | soc_analyst | Get incident |
| PATCH | `/api/soar/incidents/:id/close` | soc_manager | Close incident |
| POST | `/api/soar/incidents/:id/playbooks/run` | soc_analyst | Execute playbook |
| POST | `/api/soar/playbooks` | admin, soc_manager | Create playbook |
| GET | `/api/soar/playbook-runs` | soc_analyst | List playbook runs |
| POST | `/api/soar/artifacts/:id/enrich` | soc_analyst | Enrich artifact |
| POST | `/api/soar/webhooks/wazuh` | integration_admin | Ingest Wazuh alert |
| GET | `/api/soar/alerts` | soc_analyst | List SOAR alerts |
| POST | `/api/soar/connectors` | admin | Register connector |
| GET | `/api/soar/dashboard/overview` | soc_analyst | SOAR dashboard |

### POST `/api/soar/incidents`

**Request:**
```json
{
  "title": "Suspicious outbound connection detected",
  "description": "Host 10.0.0.15 initiated connection to known C2 IP",
  "severity": "critical",
  "sourceIP": "10.0.0.15",
  "affectedHost": "workstation-42",
  "tags": ["c2", "lateral-movement"]
}
```

### POST `/api/soar/incidents/:id/playbooks/run`

**Request:**
```json
{
  "playbookId": "674b2c3d4e5f6a7b8c9d0e1f",
  "context": {
    "sourceIP": "203.0.113.50",
    "affectedHost": "10.0.0.15"
  }
}
```

**Response (201):**
```json
{
  "success": true,
  "message": "Playbook run queued",
  "data": {
    "runId": "674c3d4e5f6a7b8c9d0e1f2a",
    "status": "queued",
    "playbookId": "674b2c3d4e5f6a7b8c9d0e1f"
  }
}
```

---

## 8.5 UCTC API

| Method | Endpoint | Roles | Description |
|--------|----------|-------|-------------|
| POST | `/api/uctc/rules` | detection_engineer | Create Sigma rule |
| GET | `/api/uctc/rules` | detection_engineer, soc_analyst | List rules |
| POST | `/api/uctc/rules/validate` | detection_engineer | Validate YAML |
| POST | `/api/uctc/rules/:ruleId/convert` | detection_engineer | Convert to SIEM format |
| POST | `/api/uctc/rules/:ruleId/deploy` | soc_manager | Deploy rule |
| POST | `/api/uctc/lab/execute-script` | detection_engineer, red_team | Run sandbox script |
| POST | `/api/uctc/lab/execute-scenario` | red_team | Run built-in scenario |
| GET | `/api/uctc/lab/runs` | detection_engineer | Sandbox run history |
| GET | `/api/uctc/tuning/noisy-rules` | soc_analyst | List noisy rules |
| POST | `/api/uctc/tuning/apply` | detection_engineer | Apply tuning exclusion |

### POST `/api/uctc/lab/execute-script`

**Request:**
```json
{
  "language": "python",
  "script": "import os\nprint(os.environ.get('PATH', 'none'))",
  "timeoutSec": 30
}
```

**Response (201):**
```json
{
  "success": true,
  "message": "Sandbox run completed",
  "data": {
    "runId": "674d4e5f6a7b8c9d0e1f2a3b",
    "status": "succeeded",
    "exitCode": 0,
    "output": "/usr/local/bin:...",
    "durationMs": 1240,
    "runnerProvider": "docker"
  }
}
```

---

## 8.6 Phishing API

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/phishing/campaigns` | JWT (manager) | Create campaign |
| POST | `/api/phishing/campaigns/:id/launch` | JWT (manager) | Launch campaign |
| GET | `/api/phishing/campaigns/:id` | JWT | Campaign detail |
| POST | `/api/phishing/recipients/import` | JWT | Import recipients |
| GET | `/api/phishing/track/open/:trackingId` | Public (rate-limited) | Track email open |
| GET | `/api/phishing/track/click/:trackingId` | Public (rate-limited) | Track link click |
| POST | `/api/phishing/track/submit/:trackingId` | Public (rate-limited) | Track credential submit |
| GET | `/api/phishing/dashboard/overview` | JWT | Campaign dashboard |

---

## 8.7 LumiNet (Network) API

| Method | Endpoint | Roles | Description |
|--------|----------|-------|-------------|
| POST | `/api/luminet/network/discover` | it_manager, detection_engineer | Subnet discovery |
| POST | `/api/luminet/network/scan-ports` | it_manager, detection_engineer | Port scan |
| GET | `/api/luminet/assets/inventory` | soc_analyst, it_manager | Asset inventory |
| GET | `/api/luminet/assets/context/:ip` | soc_analyst | Asset context for integrations |
| POST | `/api/luminet/sniffing/start` | soc_analyst, detection_engineer | Start packet capture |
| GET | `/api/luminet/network/misconfigurations` | soc_analyst | Security misconfigs |
| GET | `/api/luminet/network/flow-metrics` | soc_analyst | Traffic flow anomalies |

### POST `/api/luminet/network/scan-ports`

**Request (NetworkScanRequest contract):**
```json
{
  "target": "10.0.0.25",
  "ports": [22, 80, 443, 445],
  "scanMode": "CONNECT"
}
```

**Alternative (string normalization):**
```json
{
  "target": "10.0.0.25",
  "ports": "22,80,443",
  "scanMode": "SYN"
}
```

**Response (201):**
```json
{
  "success": true,
  "message": "Port scan completed",
  "data": {
    "task_id": "674e5f6a7b8c9d0e1f2a3b4c",
    "runner_provider": "local_tcp_connect",
    "status": "completed",
    "target": "10.0.0.25",
    "ports": [22, 80, 443, 445],
    "scanMode": "CONNECT",
    "open_ports": [
      { "port": 22, "protocol": "tcp", "service": "ssh", "state": "open" }
    ],
    "misconfigurations": []
  }
}
```

**Rejected fields** (422): `type`, `portRange`, `speed`, or any unknown key.

---

## 8.8 Integration API Summary

| Source → Target | Endpoint |
|-----------------|----------|
| Network → GRC | `POST /api/grc/integrations/network/findings` |
| Network → SOAR | `POST /api/luminet/integrations/soar/incident` |
| SOAR → GRC | `POST /api/soar/integrations/grc/finding` |
| Phishing → GRC | `POST /api/grc/integrations/phishing/risk` |
| UCTC → SIEM | `POST /api/uctc/integrations/siem/deploy` |
| SIEM → SOAR | `POST /api/soar/integrations/siem/event` |
| OpenCTI → GRC | `POST /api/grc/integrations/opencti/ioc` |

---

# 9. Real-Time System Design

## 9.1 WebSocket Architecture

LumiSec uses **Socket.IO** (v4) mounted on the same HTTP server as Express (`index.js` → `initSocket(httpServer)`).

```
┌──────────────┐         WSS          ┌──────────────────┐
│   Dashboard  │ ◄──────────────────► │  Socket.IO Server │
│   (React)    │   auth.token=JWT     │  src/utils/socket │
└──────────────┘                      └────────┬─────────┘
                                               │
                                    ┌──────────▼──────────┐
                                    │   Room Membership   │
                                    │  • role:<role>      │
                                    │  • user:<userId>    │
                                    └─────────────────────┘
```

### Connection Authentication

```javascript
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  socket.user = verifyToken(token);
  socket.join(socket.user.role);
  socket.join(`user:${socket.user._id}`);
});
```

## 9.2 Live Alerts Streaming

Workers emit real-time events via `emitAlert(room, event, data)`:

| Event | Room | Trigger |
|-------|------|---------|
| `incident:created` | `soc_analyst` | alertWorker creates incident |
| `playbook:completed` | `user:<id>` | playbookWorker finishes run |
| `playbook:failed` | `user:<id>` | playbook step failure |
| `notification:new` | `user:<id>` | notificationWorker |

### Client Subscription Pattern

```javascript
// Frontend (conceptual)
const socket = io("wss://api.lumisec.example.com", {
  auth: { token: accessToken }
});

socket.on("incident:created", (data) => {
  dashboard.addIncident(data);
  toast.alert(`New ${data.severity} incident: ${data.title}`);
});
```

## 9.3 Dashboard Updates

Real-time updates reduce polling overhead for:
- SOC incident queue depth
- Playbook run status changes
- Unread notification counts

**Fallback:** All data remains queryable via REST (`GET /api/soar/incidents`, `GET /api/soar/notifications/unread-count`) for clients without WebSocket support.

## 9.4 Event-Driven Architecture

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│  Webhook    │───►│  Bull Queue │───►│   Worker    │
│  Ingestion  │    │             │    │             │
└─────────────┘    └─────────────┘    └──────┬──────┘
                                               │
                    ┌──────────────────────────┼──────────────────────────┐
                    ▼                          ▼                          ▼
             ┌─────────────┐           ┌─────────────┐           ┌─────────────┐
             │  MongoDB    │           │ Socket.IO   │           │ Integration │
             │  Persist    │           │  Emit       │           │  HTTP Call  │
             └─────────────┘           └─────────────┘           └─────────────┘
```

This **event-driven** pattern ensures:
- Webhook endpoints respond quickly (202/201) without blocking on downstream processing
- Failures in workers do not cause webhook source retries (at-least-once queue delivery)
- Multiple consumers (dashboard, audit, integration) react to the same event independently

---

# 10. Background Jobs & Queues

## 10.1 Job Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Bull Queue Architecture                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  API Process (Producer)          Worker Process (Consumer)       │
│  ┌─────────────────┐             ┌─────────────────────────┐    │
│  │ controller/     │  queue.add  │ worker/*.js             │    │
│  │ service         │ ──────────► │ queue.process(name, fn) │    │
│  └─────────────────┘             └─────────────────────────┘    │
│           │                                    │                 │
│           └────────────┬───────────────────────┘                 │
│                        ▼                                         │
│               ┌─────────────────┐                              │
│               │  Redis (ioredis) │                              │
│               │  Queue state +    │                              │
│               │  Job persistence  │                              │
│               └─────────────────┘                              │
└─────────────────────────────────────────────────────────────────┘
```

### Queue Registry

| Queue Name | Producer | Consumer | Concurrency |
|------------|----------|----------|-------------|
| `lumisec.phishing.email` | campaign.service | emailWorker | 5 |
| `lumisec.phishing.tracking` | tracking endpoints | trackingWorker | 10 |
| `lumisec.phishing.risk` | event handlers | riskWorker | 2 |
| `lumisec.soar.legacy` | playbookEngine | playbookWorker | 1 |
| `lumisec.soar.enrichment` | artifact.service | enrichmentWorker | 3 |
| `lumisec.soar.alert` | webhook.service | alertWorker | 2 |
| `lumisec.soar.notification` | various | notificationWorker | 5 |
| `lumisec.soar.analytics` | analytics endpoints | analyticsWorker | 1 |
| `lumisec.soar.integration` | integration endpoints | integrationWorker | 2 |
| `lumisec.uctc.rule` | rule.service | ruleWorker | 2 |
| `lumisec.report` | report.service | reportWorker | 1 |

## 10.2 Retry Mechanisms

Playbook jobs use exponential backoff:

```javascript
await soarQueue.add("executePlaybookRun", payload, {
  attempts: 3,
  backoff: { type: "exponential", delay: 2000 }
});
```

| Attempt | Delay |
|---------|-------|
| 1 | Immediate |
| 2 | 2 seconds |
| 3 | 4 seconds |

After 3 failures, job moves to **failed** state in Redis, inspectable via Bull Board (recommended production addition).

## 10.3 Dead Letter Queue Pattern

Bull does not have a native DLQ. LumiSec implements DLQ semantics via:

1. `attempts` limit — job marked failed after exhaustion
2. Failed job retention in Redis (default: removeOnFail: false recommended)
3. Worker logging via Winston (`logger.error`) with job ID and payload
4. **Recommended production extension:** `failed` event handler → `deadLetterQueue.add()`

```javascript
playbookQueue.on("failed", (job, err) => {
  logger.error({ jobId: job.id, error: err.message, data: job.data });
  deadLetterQueue.add("review", { originalJob: job.data, error: err.message });
});
```

## 10.4 Malware Analysis Jobs

UCTC sandbox execution is **synchronous within the API request** for analyst feedback, but long-running cloud sandbox executions should migrate to:

```
POST /lab/execute-script → SandboxRun (queued)
                         → sandboxQueue.add()
                         → sandboxWorker → Docker/cloud runner
                         → Socket.IO emit on completion
```

## 10.5 Log Processing Pipelines

```
Log Agent → Elasticsearch (logs-*)
          → ELK query (getRecentAlerts)
          → POST /api/soar/webhooks/splunk
          → alertQueue → alertWorker
          → Incident + GRC finding (optional)
          → Socket.IO push
```

---

# 11. Performance & Scalability

## 11.1 Horizontal Scaling

| Component | Scaling Strategy |
|-----------|-----------------|
| API server | Nginx load balancer → N Express instances |
| Workers | `docker compose up --scale playbook-worker=3` |
| MongoDB | Replica set (3 nodes) + read preference secondary |
| Redis | Redis Cluster or Sentinel for HA |
| Elasticsearch | Multi-node cluster with shard allocation |

## 11.2 Load Balancing

```
                    ┌─────────────┐
    Clients ──────► │   Nginx     │
                    │   (LB+TLS)  │
                    └──────┬──────┘
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
         ┌─────────┐ ┌─────────┐ ┌─────────┐
         │ API :3000│ │ API :3000│ │ API :3000│
         └─────────┘ └─────────┘ └─────────┘
```

Nginx configuration essentials:
- `upstream lumisec_api` with `least_conn` balancing
- `proxy_set_header X-Real-IP $remote_addr`
- WebSocket upgrade headers for Socket.IO
- `client_max_body_size 50m` for evidence uploads

## 11.3 Caching Strategy

| Data | Cache | TTL | Invalidation |
|------|-------|-----|--------------|
| Connector discovery | Redis | 5 min (`CONNECTOR_DISCOVERY_CACHE_MS`) | On connector update |
| Dashboard KPIs | AnalyticsSnapshot collection | 1 hour | analyticsWorker refresh |
| User profile | None (DB query per request) | — | — |
| Framework requirements | In-memory (seed data) | Until restart | Re-seed |

## 11.4 Database Optimization

- **Pagination enforced** on all list endpoints (default `limit: 20`, max `100`)
- **Lean queries** for dashboard aggregations
- **Compound indexes** aligned to filter + sort patterns (see Section 7.3)
- **Soft deletes** avoid expensive cascade deletes
- **Partial unique indexes** reduce index size for sparse fields

## 11.5 API Performance Tuning

| Technique | Impact |
|-----------|--------|
| `asyncHandler` wrapper | Prevents unhandled promise rejections |
| Joi `stripUnknown` | Reduces payload processing overhead |
| Connection pooling (Mongoose) | Reuses TCP connections to MongoDB |
| Worker offloading | API P95 < 200ms for CRUD operations |
| `axios-retry` on integrations | Resilience without blocking API thread |
| Network scan concurrency (`LUMINET_SCAN_CONCURRENCY=64`) | Parallel TCP probes |

---

# 12. Logging & Monitoring

## 12.1 Centralized Logging

Winston logger configuration (`src/utils/logger.js`):

```javascript
winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: "logs/error.log", level: "error" }),
    new winston.transports.File({ filename: "logs/combined.log" })
  ]
});
```

### Log Structure

```json
{
  "timestamp": "2026-06-12T10:30:00.000Z",
  "level": "error",
  "message": "Validation failed",
  "path": "/api/luminet/network/scan-ports",
  "method": "POST",
  "stack": "Error: Validation failed..."
}
```

### Production Recommendation

Ship logs to ELK via Filebeat/Logstash:
```
App logs → Filebeat → Elasticsearch (logs-lumisec-*)
                     → Kibana dashboards
```

## 12.2 Error Tracking

`globalErrorHandling` middleware captures all unhandled errors:

- Logs full stack trace server-side
- Returns sanitized message to client (no stack in production)
- Includes `statusCode` from `AppError` instances

**Recommended:** Integrate Sentry or Datadog APM for error aggregation and alerting.

## 12.3 Metrics Collection

| Metric | Source | Tool |
|--------|--------|------|
| Request rate/latency | Nginx access logs | Prometheus + Grafana |
| Queue depth | Redis `LLEN` | Bull Board / custom exporter |
| Worker job duration | Winston structured logs | ELK aggregation |
| MongoDB ops/sec | MongoDB serverStatus | MongoDB Cloud Manager |
| Incident MTTR | `incidents` aggregation | SOAR analytics endpoint |

## 12.4 Health Checks

```
GET /health
GET /api/health

Response: { "status": "ok", "service": "LumiSec API" }
```

**Recommended production extensions:**
```json
{
  "status": "ok",
  "service": "LumiSec API",
  "checks": {
    "mongodb": "connected",
    "redis": "connected",
    "elasticsearch": "reachable"
  },
  "uptime": 86400,
  "version": "1.0.0"
}
```

Docker Compose `depends_on` ensures worker startup ordering. Kubernetes deployments should use `livenessProbe` and `readinessProbe` on `/api/health`.

---

# 13. Security Design

## 13.1 OWASP Top 10 Mitigation

| OWASP Risk | LumiSec Mitigation |
|------------|-------------------|
| **A01 Broken Access Control** | RBAC on every protected route; `isAuthorized()` middleware; per-module `permissions.js` |
| **A02 Cryptographic Failures** | bcrypt(12) passwords; AES-256 vault encryption; TLS via Nginx; JWT HMAC-SHA256 |
| **A03 Injection** | Joi input validation; Mongoose parameterized queries; Sigma YAML validation before execution |
| **A04 Insecure Design** | Modular monolith with integration contracts; sandbox isolation; network scan input sanitization |
| **A05 Security Misconfiguration** | `.env.example` documents all secrets; Docker non-root sandbox user; `unknown(false)` on critical schemas |
| **A06 Vulnerable Components** | `npm ci` in Docker; dependency auditing via `npm audit` |
| **A07 Auth Failures** | JWT expiry; suspended account check; rate limiting on public endpoints |
| **A08 Data Integrity Failures** | Immutable `auditlogs`; webhook payload validation; evidence file hash (recommended) |
| **A09 Logging Failures** | Winston JSON logs; global error handler; audit trail for GRC mutations |
| **A10 SSRF** | Integration URLs from environment only; worker URLs configurable but not user-controlled |

## 13.2 API Security

- **CORS:** `configureCors(app)` allowlists `FRONTEND_URL` and `CORS_ALLOWED_ORIGINS`
- **Authentication:** Bearer JWT on all protected routes
- **Service auth:** `x-internal-api-key` for machine-to-machine calls
- **Input sanitization:** Joi `stripUnknown: true` replaces raw `req.body`
- **File uploads:** Multer with size limits and MIME type validation
- **Rate limiting:** Public tracking endpoints throttled to 120 req/min/IP

## 13.3 Data Encryption

| Data State | Method |
|------------|--------|
| Passwords at rest | bcrypt hash (cost 12) |
| Vault credentials | AES-256-GCM (`vaultCrypto.js`) |
| Data in transit | TLS 1.2+ (Nginx termination) |
| JWT | HMAC-SHA256 signed |
| MongoDB at rest | DigitalOcean encrypted volumes (infrastructure) |

## 13.4 Network Security

### DigitalOcean VPC Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    DigitalOcean VPC                          │
│  ┌─────────────────────────────────────────────────────┐    │
│  │                  Private Network (10.10.0.0/16)      │    │
│  │                                                      │    │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────────────┐  │    │
│  │  │ Nginx LB │  │ API (x3) │  │ Workers (x10)    │  │    │
│  │  │ :443     │  │ :3000    │  │ (no public IP)   │  │    │
│  │  └──────────┘  └──────────┘  └──────────────────┘  │    │
│  │                                                      │    │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────────────┐  │    │
│  │  │ MongoDB  │  │  Redis   │  │ Elasticsearch    │  │    │
│  │  │ :27017   │  │ :6379    │  │ :9200            │  │    │
│  │  └──────────┘  └──────────┘  └──────────────────┘  │    │
│  │                                                      │    │
│  │  ┌──────────────────┐  ┌───────────────────────┐   │    │
│  │  │ Scanner Worker   │  │ Sniffer Worker        │   │    │
│  │  │ :4100            │  │ :4200                 │   │    │
│  │  └──────────────────┘  └───────────────────────┘   │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
         ▲
         │ HTTPS :443 only
    Internet / Frontend
```

### Firewall Rules (DigitalOcean Cloud Firewall)

| Direction | Protocol | Port | Source | Destination | Purpose |
|-----------|----------|------|--------|-------------|---------|
| Inbound | TCP | 443 | 0.0.0.0/0 | Load Balancer | Public HTTPS |
| Inbound | TCP | 22 | Admin IP/32 | Bastion | SSH management |
| Inbound | TCP | 3000 | LB private IP | API droplets | Internal routing |
| Outbound | TCP | 443 | API/Workers | 0.0.0.0/0 | External integrations |
| Inbound | TCP | 27017 | API/Workers SG | MongoDB SG | Database |
| Inbound | TCP | 6379 | API/Workers SG | Redis SG | Queues |
| Deny | ALL | ALL | 0.0.0.0/0 | Database/Redis | No public DB access |

---

# 14. Deployment Architecture

## 14.1 CI/CD Pipeline

```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│  Git     │───►│  CI      │───►│  Test    │───►│  Build   │───►│  Deploy  │
│  Push    │    │  Trigger │    │  Suite   │    │  Docker  │    │  DO K8s  │
└──────────┘    └──────────┘    └──────────┘    └──────────┘    └──────────┘
```

### Recommended Pipeline Stages

1. **Lint & Audit** — `npm audit`, ESLint (future)
2. **Unit/Integration Tests** — `npm test`, `npm run test:network`, `npm run test:connector-engine`
3. **Build** — `docker build -t lumisec-api:$SHA .`
4. **Push** — DigitalOcean Container Registry
5. **Deploy** — Rolling update to droplet/K8s cluster
6. **Smoke Test** — `GET /api/health` + auth login test

## 14.2 Docker Containerization

### API Container

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
RUN mkdir -p uploads/evidence uploads/reports uploads/soar-analytics
EXPOSE 3000
CMD ["node", "index.js"]
```

### Worker Containers

Same image, different `command`:
```yaml
playbook-worker:
  build: .
  command: node src/workers/playbookWorker.js
  depends_on: [mongo, redis]
```

## 14.3 Nginx Reverse Proxy

```nginx
upstream lumisec_backend {
    least_conn;
    server 10.10.0.10:3000;
    server 10.10.0.11:3000;
    server 10.10.0.12:3000;
}

server {
    listen 443 ssl http2;
    server_name api.lumisec.example.com;

    ssl_certificate     /etc/nginx/ssl/fullchain.pem;
    ssl_certificate_key /etc/nginx/ssl/privkey.pem;
    ssl_protocols       TLSv1.2 TLSv1.3;

    location / {
        proxy_pass http://lumisec_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## 14.4 SSL Configuration

- **Certificate:** Let's Encrypt via Certbot or DigitalOcean managed certificates
- **Protocols:** TLS 1.2+ only
- **HSTS:** `max-age=31536000; includeSubDomains`
- **Internal traffic:** VPC private network (optional mTLS between services for high-security deployments)

## 14.5 DigitalOcean Infrastructure Setup

| Resource | Specification | Purpose |
|----------|--------------|---------|
| Load Balancer | DO LB ($12/mo) | HTTPS termination, health checks |
| API Droplets | 3× s-2vcpu-4gb | Express + Socket.IO |
| Worker Droplet | 1× s-4vcpu-8gb | 10 Bull workers |
| MongoDB | DO Managed MongoDB (M10+) | Primary datastore |
| Redis | DO Managed Redis | Queue broker |
| Elasticsearch | Self-hosted s-4vcpu-8gb or Elastic Cloud | SIEM log storage |
| Scanner Worker | 1× s-2vcpu-4gb (privileged) | Nmap/TCP scanning |
| Spaces (S3) | Object storage | Evidence/report archival (recommended) |

### Environment Configuration

All secrets managed via `config/.env` (never committed):

```bash
PORT=3000
MONGO_URI=mongodb+srv://...
REDIS_URL=redis://...
JWT_SECRET=<256-bit-random>
INTERNAL_API_KEY=<random>
ELASTICSEARCH_URL=https://...
FRONTEND_URL=https://dashboard.lumisec.example.com
```

---

# 15. Conclusion

## 15.1 Backend Achievements

The LumiSec backend represents a **production-oriented, integration-first cybersecurity platform** that successfully unifies:

1. **Governance & Compliance** — Full finding/risk/control lifecycle with audit trails, evidence management, and multi-framework compliance mapping
2. **Security Orchestration** — Playbook-driven automation with real connector integrations (Fortigate, SSH, WinRM, OpenCTI, SMTP)
3. **Detection Engineering** — Sigma rule validation, conversion, deployment, and tuning with noisy-rule feedback loops
4. **Human Risk Management** — End-to-end phishing simulation with behavioral tracking and cross-module risk propagation
5. **Network Visibility** — Real discovery, port scanning, and packet capture via isolated worker delegation
6. **Threat Intelligence** — OpenCTI enrichment woven into SOAR artifacts, GRC findings, and network asset context
7. **Real-Time Operations** — Socket.IO event streaming for SOC analyst reactivity
8. **Resilient Async Processing** — 10+ Bull worker types with retry, concurrency control, and Docker-based deployment

## 15.2 Design Quality Assessment

| Criterion | Rating | Evidence |
|-----------|--------|----------|
| Modularity | ★★★★★ | 6 domain modules with consistent router/controller/service pattern |
| Security | ★★★★☆ | JWT + RBAC + validation + sandbox isolation; MFA/refresh tokens planned |
| Scalability | ★★★★☆ | Horizontal API scaling, worker extraction, queue-based async |
| Integration | ★★★★★ | 20+ cross-module integration endpoints with dual auth |
| Observability | ★★★☆☆ | Winston logging + health checks; APM/metrics recommended |
| Testability | ★★★★☆ | node:test + supertest + mongodb-memory-server |
| Documentation | ★★★★☆ | OpenAPI specs (GRC, SOAR), Postman generator, this chapter |

## 15.3 Evolution Roadmap

| Phase | Enhancement |
|-------|-------------|
| Near-term | Refresh token rotation, Redis rate limiting, MFA for admin roles |
| Medium-term | Extract scanner/sniffer workers to K8s jobs, BullMQ migration |
| Long-term | Event sourcing for incident timeline, GraphQL federation layer, multi-tenant isolation |

## 15.4 Final Statement

The LumiSec backend architecture demonstrates that a **modular monolith** can deliver enterprise-grade security platform capabilities without premature microservice complexity. By enforcing strict API contracts (e.g., `NetworkScanRequest`), layered security middleware, and event-driven async processing, the system achieves the reliability, auditability, and integration depth required for real-world SOC, GRC, and detection engineering workflows — while maintaining a clear evolutionary path toward distributed deployment at scale.

---

## Appendix A: Complete Environment Variable Reference

| Variable | Module | Description |
|----------|--------|-------------|
| `PORT` | Core | API listen port (default 3000) |
| `MONGO_URI` | Core | MongoDB connection string |
| `REDIS_URL` | Core | Redis connection for Bull queues |
| `JWT_SECRET` | Auth | HMAC signing key |
| `JWT_EXPIRES_IN` | Auth | Token TTL (default 1h) |
| `INTERNAL_API_KEY` | Integration | Service-to-service auth key |
| `FRONTEND_URL` | CORS | Primary allowed origin |
| `CORS_ALLOWED_ORIGINS` | CORS | Additional allowed origins |
| `ELASTICSEARCH_URL` | SIEM | ELK cluster endpoint |
| `OPENCTI_URL` | Threat Intel | OpenCTI GraphQL endpoint |
| `OPENCTI_TOKEN` | Threat Intel | API bearer token |
| `LUMINET_SCAN_MODE` | Network | local / worker / cloud |
| `LUMINET_SNIFFING_MODE` | Network | worker / cloud |
| `LUMINET_SCANNER_WORKER_URL` | Network | External scanner service |
| `LUMINET_SNIFFER_WORKER_URL` | Network | External sniffer service |
| `UCTC_SANDBOX_MODE` | Sandbox | mock / docker |
| `SOAR_CONNECTOR_MODE` | SOAR | local / engine |
| `CONNECTOR_ENGINE_URL` | SOAR | Python connector engine |
| `SMTP_HOST` | Email | Mail server for phishing/SOAR |
| `FORTIGATE_HOST` | SOAR | Firewall API endpoint |
| `QUEUE_PREFIX` | Workers | Bull queue namespace |

## Appendix B: Complete SOAR Endpoint Inventory

| # | Method | Endpoint |
|---|--------|----------|
| 1 | POST | `/api/soar/incidents` |
| 2 | GET | `/api/soar/incidents` |
| 3 | GET | `/api/soar/incidents/:id` |
| 4 | PATCH | `/api/soar/incidents/:id` |
| 5 | DELETE | `/api/soar/incidents/:id` |
| 6 | PATCH | `/api/soar/incidents/:id/close` |
| 7 | GET | `/api/soar/incidents/:id/timeline` |
| 8 | GET | `/api/soar/incidents/:id/artifacts` |
| 9 | POST | `/api/soar/incidents/:id/artifacts` |
| 10 | GET | `/api/soar/incidents/:id/notes` |
| 11 | POST | `/api/soar/incidents/:id/notes` |
| 12 | GET | `/api/soar/incidents/:id/related` |
| 13 | POST | `/api/soar/incidents/:id/related` |
| 14 | POST | `/api/soar/incidents/:id/playbooks/run` |
| 15 | POST | `/api/soar/playbooks` |
| 16 | GET | `/api/soar/playbooks` |
| 17 | GET | `/api/soar/playbooks/:id` |
| 18 | PATCH | `/api/soar/playbooks/:id` |
| 19 | DELETE | `/api/soar/playbooks/:id` |
| 20 | GET | `/api/soar/playbook-runs` |
| 21 | GET | `/api/soar/playbook-runs/:runId` |
| 22 | POST | `/api/soar/playbook-runs/:runId/pause` |
| 23 | POST | `/api/soar/playbook-runs/:runId/resume` |
| 24 | POST | `/api/soar/playbook-runs/:runId/cancel` |
| 25 | GET | `/api/soar/artifacts` |
| 26 | POST | `/api/soar/artifacts/:id/enrich` |
| 27 | POST | `/api/soar/artifacts/enrich/bulk` |
| 28 | POST | `/api/soar/webhooks/crowdstrike` |
| 29 | POST | `/api/soar/webhooks/fortigate` |
| 30 | POST | `/api/soar/webhooks/wazuh` |
| 31 | POST | `/api/soar/webhooks/defender` |
| 32 | POST | `/api/soar/webhooks/splunk` |
| 33 | POST | `/api/soar/webhooks/custom` |
| 34 | GET | `/api/soar/alerts` |
| 35 | POST | `/api/soar/connectors` |
| 36 | POST | `/api/soar/connectors/:id/test` |
| 37 | POST | `/api/soar/vault` |
| 38 | GET | `/api/soar/dashboard/overview` |
| 39 | GET | `/api/soar/analytics/kpis` |
| 40 | POST | `/api/soar/analytics/export` |
| 41 | GET | `/api/soar/notifications` |
| 42 | POST | `/api/soar/integrations/grc/finding` |
| 43 | POST | `/api/soar/integrations/siem/event` |
| 44 | POST | `/api/soar/integrations/firewall/block-ip` |

## Appendix C: Complete GRC Endpoint Inventory

| # | Method | Endpoint |
|---|--------|----------|
| 1 | POST | `/api/grc/findings` |
| 2 | GET | `/api/grc/findings` |
| 3 | PATCH | `/api/grc/findings/:id/close` |
| 4 | PATCH | `/api/grc/findings/:id/reopen` |
| 5 | POST | `/api/grc/findings/:id/retest` |
| 6 | POST | `/api/grc/risks` |
| 7 | PATCH | `/api/grc/risks/:id/accept` |
| 8 | PATCH | `/api/grc/risks/:id/mitigate` |
| 9 | POST | `/api/grc/tasks` |
| 10 | PATCH | `/api/grc/tasks/:id/complete` |
| 11 | PATCH | `/api/grc/tasks/:id/verify` |
| 12 | POST | `/api/grc/evidence` |
| 13 | POST | `/api/grc/reports/:id/generate` |
| 14 | GET | `/api/grc/reports/:id/download` |
| 15 | POST | `/api/grc/compliance/controls` |
| 16 | GET | `/api/grc/compliance/status` |
| 17 | GET | `/api/grc/dashboard/risk-heatmap` |
| 18 | GET | `/api/grc/audit-logs` |
| 19 | POST | `/api/grc/integrations/siem/alerts` |
| 20 | POST | `/api/grc/integrations/network/findings` |
| 21 | POST | `/api/grc/integrations/soar/incidents` |
| 22 | POST | `/api/grc/integrations/phishing/risk` |
| 23 | POST | `/api/grc/integrations/opencti/ioc` |

## Appendix D: Test Suite Reference

| Command | Scope |
|---------|-------|
| `npm test` | Auth, GRC, health, phishing, SOAR, UCTC, integrations |
| `npm run test:network` | LumiNet API + network asset service |
| `npm run test:connector-engine` | SOAR connector engine integration |

Tests use `node:test` (native Node.js test runner) with `supertest` for HTTP assertions and `mongodb-memory-server` for isolated database testing.

## Appendix E: Glossary

| Term | Definition |
|------|------------|
| **GRC** | Governance, Risk, and Compliance |
| **SOAR** | Security Orchestration, Automation, and Response |
| **UCTC** | Unified Cyber Threat Center (detection engineering) |
| **LumiNet** | Network discovery, scanning, and visibility module |
| **IOC** | Indicator of Compromise |
| **Sigma** | Generic signature format for SIEM detection rules |
| **MTTR** | Mean Time to Resolve (incident metric) |
| **RBAC** | Role-Based Access Control |
| **DLQ** | Dead Letter Queue (failed job retention) |
| **VPC** | Virtual Private Cloud (network isolation) |

---

*Document generated from the LumiSec-Backendzz repository (v1.0.0). For API reference details, see `docs/grc-openapi.json` and `docs/soar-openapi.json`.*
