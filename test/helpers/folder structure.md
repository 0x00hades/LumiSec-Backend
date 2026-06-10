# LumiSec Backend — Folder Structure

A full breakdown of every directory and file in this project, what it does, and why it exists.

---

```
lumisec-backend/
│
├── index.js                          # Entry point — loads env, creates HTTP server, connects DB, boots app
├── package.json                      # Project dependencies and npm scripts
├── docker-compose.yml                # Docker setup (MongoDB, Redis, etc.)
├── .gitignore
│
├── config/
│   └── .env.example                  # Template for environment variables (copy to config/.env)
│
├── database/
│   ├── connection.js                 # Connects to MongoDB using MONGO_URI from env
│   ├── index.js                      # Central re-export of all Mongoose models
│   └── models/
│       ├── user.model.js             # User schema (name, email, password, role, status, department, lastLogin)
│       ├── sigmaRule.model.js        # Sigma detection rule (rawSigma, convertedQuery, targetSiem, status, mitre fields)
│       ├── incident.model.js         # SOAR incident (title, severity, status, assignedTo, playbook, actions, notes)
│       ├── playbook.model.js         # Automated response playbook (name, triggerType, triggerCondition, actions)
│       ├── campaign.model.js         # Phishing campaign (name, template, status, stats, recipients, launchedAt)
│       ├── recipient.model.js        # Individual phishing target (email, trackingId, riskScore, emailSent)
│       ├── event.model.js            # Phishing event log (open / click / submit events per recipient)
│       ├── finding.model.js          # GRC audit finding (title, riskRating, severity, status, retestResult)
│       ├── remediationTask.model.js  # Remediation task tied to a finding (assignedTo, dueDate, evidence)
│       └── auditReport.model.js      # GRC audit report that groups multiple findings
│
├── src/
│   ├── app.js                        # Exports createApp() factory — used by server AND tests
│   ├── bootstrap.js                  # Registers all middleware and routes onto the Express app
│   │
│   ├── modules/                      # Feature modules (one folder per domain)
│   │   ├── index.js                  # Aggregates and exports all module routers
│   │   │
│   │   ├── auth/
│   │   │   ├── auth.router.js        # Routes: POST /signup, POST /login, GET /profile
│   │   │   ├── auth.controller.js    # Logic: signup (bcrypt + JWT), login, return profile
│   │   │   └── auth.validation.js    # Joi schemas for signup and login payloads
│   │   │
│   │   ├── uctc/                     # Unified Cyber Threat Correlation — Sigma rule management
│   │   │   ├── uctc.router.js        # Routes: POST /rules, GET /rules, POST /rules/:id/deploy
│   │   │   ├── uctc.controller.js    # Logic: createRule, getRules (paginated), deployRule
│   │   │   └── uctc.validation.js    # Joi schemas for rule creation and status update
│   │   │
│   │   ├── soar/                     # Security Orchestration, Automation & Response
│   │   │   ├── soar.router.js        # Routes: POST/GET /incidents, POST /:id/playbook/:pid, PATCH /:id/close
│   │   │   ├── soar.controller.js    # Logic: createIncident, executePlaybook, closeIncident, getIncidents
│   │   │   └── soar.validation.js    # Joi schemas for incident creation and close payload
│   │   │
│   │   ├── phishing/                 # Phishing simulation campaigns
│   │   │   ├── phishing.router.js    # Routes: POST /, POST /:id/launch, GET /, POST /track/:trackingId
│   │   │   ├── phishing.controller.js# Logic: createCampaign, launchCampaign, trackEvent, getCampaigns
│   │   │   └── phishing.validation.js# Joi schemas for campaign creation
│   │   │
│   │   └── grc/                      # Governance, Risk & Compliance
│   │       ├── grc.router.js         # Routes: POST/GET /findings, PATCH /:id/close, POST /tasks
│   │       ├── grc.controller.js     # Logic: createFinding, closeFinding, createRemediationTask, getFindings
│   │       └── grc.validation.js     # Joi schemas for finding and task creation
│   │
│   ├── middleware/
│   │   ├── authentication.js         # Reads Bearer token, verifies JWT, loads req.authUser
│   │   ├── authorization.js          # Checks req.authUser.role against allowed roles list
│   │   ├── validation.js             # Runs Joi schema against merged body+params+query, returns 422 on failure
│   │   ├── asyncHandler.js           # Wraps async controllers so errors are forwarded to global handler
│   │   └── globalErrorHandling.js    # Catches all errors, logs via Winston, returns unified JSON error response
│   │
│   ├── integrations/                 # External service clients
│   │   ├── elk.js                    # ELK / Elasticsearch client (push/query detection rules)
│   │   ├── firewall.js               # Firewall API client (block IPs, update rules)
│   │   ├── mailer.js                 # SMTP mailer (used by emailWorker to send phishing emails)
│   │   ├── opencti.js                # OpenCTI threat intelligence platform client
│   │   ├── ssh.js                    # SSH client (execute remote commands on Linux hosts)
│   │   └── winrm.js                  # WinRM client (execute remote commands on Windows hosts)
│   │
│   ├── utils/
│   │   ├── apiResponse.js            # successResponse() and paginatedResponse() — unified API output shape
│   │   ├── appError.js               # AppError class — operational errors with statusCode and status
│   │   ├── logger.js                 # Winston logger instance (console + file transports)
│   │   ├── queue.js                  # Defines Bull queues: emailQueue, soarQueue, ruleQueue, reportQueue
│   │   ├── socket.js                 # Initialises Socket.IO and exports emitAlert() for real-time alerts
│   │   ├── token.js                  # signToken() and verifyToken() JWT helpers
│   │   ├── constant/
│   │   │   └── enums.js              # Role enums: admin, soc_analyst, soc_manager, detection_engineer, etc.
│   │   └── helpers/                  # Miscellaneous utility functions shared across modules
│   │
│   └── workers/                      # Background job processors (consume from Bull queues)
│       ├── emailWorker.js            # Processes emailQueue — sends phishing emails via mailer integration
│       ├── soarWorker.js             # Processes soarQueue — executes playbook actions (SSH, WinRM, firewall)
│       ├── ruleWorker.js             # Processes ruleQueue — converts Sigma YAML to SIEM-specific queries
│       └── reportWorker.js           # Processes reportQueue — generates audit/GRC reports
│
├── test/
│   ├── auth.api.test.js              # Integration tests for Auth endpoints (signup, login, profile)
│   ├── uctc.api.test.js              # Integration tests for UCTC endpoints (create, list, deploy rules)
│   ├── soar.api.test.js              # Integration tests for SOAR endpoints (incidents, playbooks)
│   ├── phishing.api.test.js          # Integration tests for Phishing endpoints (campaign, launch, track)
│   ├── grc.api.test.js               # Integration tests for GRC endpoints (findings, tasks, close)
│   ├── health.api.test.js            # Integration test for GET /health
│   └── helpers/
│       ├── testApp.js                # Test utilities: initTestEnv, clearTestDb, closeTestEnv, buildTestApp
│       └── folder structure.md      # ← YOU ARE HERE — full project folder structure reference
│
├── docs/
│   └── PROJECT_EXPLANATION.md        # Deep-dive Arabic explanation of the project architecture and modules
│
└── postman/
    └── LumiSec-API.postman_collection.json   # Postman collection with all endpoints ready to import and run
```

---

## Top-Level Directories at a Glance

| Directory      | Purpose                                                                 |
|----------------|-------------------------------------------------------------------------|
| `config/`      | Environment variable templates                                          |
| `database/`    | MongoDB connection and all Mongoose models                              |
| `src/`         | All application source code                                             |
| `src/modules/` | Domain-driven feature modules (auth, uctc, soar, phishing, grc)        |
| `src/middleware/` | Shared request pipeline: auth, validation, error handling            |
| `src/integrations/` | Clients for external services (ELK, mailer, SSH, WinRM, OpenCTI)  |
| `src/utils/`   | Shared utilities: responses, errors, queues, logger, socket, tokens     |
| `src/workers/` | Background Bull job processors                                          |
| `test/`        | API integration tests (node:test + supertest + mongodb-memory-server)  |
| `test/helpers/`| Test environment setup and teardown helpers                             |
| `docs/`        | Human-readable project documentation                                    |
| `postman/`     | Postman collection for manual API testing                               |

---

## Request Lifecycle (Summary)

Every HTTP request flows through this pipeline:

```
Router → isAuthenticated() → isAuthorized([roles]) → isValid(schema) → asyncHandler(controller) → successResponse()
                                                                                                  ↘ globalErrorHandling() on any error
```

Background work (email sending, playbook execution, rule conversion, report generation) is **offloaded to Bull queues** and processed by workers in `src/workers/`, keeping the API fast and non-blocking.

Real-time alerts are pushed to connected clients via **Socket.IO** (`src/utils/socket.js`) when incidents, phishing events, or security actions occur.
