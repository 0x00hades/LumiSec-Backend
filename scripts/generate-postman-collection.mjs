import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { randomUUID } from "crypto";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const OUT_DIR = path.join(ROOT, "postman");

const ROUTERS = [
  { file: "src/modules/auth/auth.router.js", prefix: "/api/auth", module: "Auth" },
  { file: "src/modules/grc/grc.router.js", prefix: "/api/grc", module: "GRC" },
  { file: "src/modules/phishing/phishing.router.js", prefix: "/api/phishing", module: "Phishing" },
  { file: "src/modules/soar/soar.router.js", prefix: "/api/soar", module: "SOAR" },
  { file: "src/modules/uctc/uctc.router.js", prefix: "/api/uctc", module: "UCTC" },
  { file: "src/modules/network/network.router.js", prefix: "/api/luminet", module: "Network" }
];

const BOOTSTRAP_ROUTES = [
  { method: "GET", path: "/health", module: "System", name: "Health Check (root)" },
  { method: "GET", path: "/api/health", module: "System", name: "Health Check (API)" },
  { method: "GET", path: "/api/grc/docs/openapi.json", module: "GRC", name: "GRC OpenAPI Spec" },
  { method: "GET", path: "/api/soar/docs/openapi.json", module: "SOAR", name: "SOAR OpenAPI Spec" }
];

const SAMPLE_BODIES = {
  "/api/auth/signup": { name: "Admin User", email: "admin@lumisec.io", password: "Password123!", role: "admin", department: "SOC" },
  "/api/auth/login": { email: "admin@lumisec.io", password: "Password123!" },
  "/api/grc/findings": { title: "Unauthorized SMB share", description: "SMB share accessible without authentication", severity: "high", riskRating: "high", asset: "10.0.0.15", tags: ["network"] },
  "/api/grc/risks": { title: "Data exposure risk", description: "Sensitive data may be exposed", likelihood: 4, impact: 4 },
  "/api/grc/tasks": { findingId: "{{findingId}}", title: "Patch affected server", description: "Apply security patches", assignedTo: "{{userId}}", priority: "high" },
  "/api/grc/reports": { title: "Q2 Security Audit", description: "Quarterly internal audit", framework: "ISO27001" },
  "/api/grc/compliance/controls": { framework: "ISO27001", controlId: "A.8.1", title: "Asset inventory", description: "Maintain inventory of assets" },
  "/api/grc/integrations/network/findings": { title: "Telnet exposed", description: "Telnet service on asset", severity: "high", sourceId: "scan-001:telnet:10.0.0.5", asset: "10.0.0.5" },
  "/api/grc/integrations/uctc/findings": { title: "Detection gap", description: "No rule covers process creation", severity: "medium", sourceId: "gap-001", asset: "10.0.0.21" },
  "/api/grc/integrations/soar/incidents": { incidentId: "{{incidentId}}", title: "SOAR incident finding", description: "Escalated from SOAR", severity: "high", createRisk: true },
  "/api/grc/integrations/phishing/risk": { title: "Phishing credential submit", description: "User submitted credentials", eventType: "submit", sourceId: "phish-evt-001" },
  "/api/grc/integrations/siem/alerts": { alertId: "siem-alert-001", ruleName: "Brute Force", severity: "high", sourceIp: "10.0.0.15", indexName: "winlogbeat-*" },
  "/api/grc/integrations/opencti/ioc": { indicator: "malicious.example.com", iocType: "domain", title: "Phishing domain", confidence: 4 },
  "/api/phishing/templates": { name: "Security Alert", subject: "Action required", htmlBody: "<p>Please review your account</p>" },
  "/api/phishing/landing-pages": { name: "Login Clone", htmlContent: "<form><input name='username'/></form>" },
  "/api/phishing/recipients/import": { csv: "name,email,department\nJohn Doe,john@lumisec.io,IT" },
  "/api/phishing/campaigns": { name: "Q2 Awareness", templateId: "{{templateId}}" },
  "/api/phishing/track/submit/:trackingId": { username: "victim@lumisec.io" },
  "/api/phishing/integrations/grc/risk": { title: "High risk user", description: "Multiple clicks", eventType: "click" },
  "/api/phishing/integrations/soar/incident": { title: "Phishing incident", description: "High risk phishing event", severity: "high", campaignId: "{{campaignId}}", eventType: "submit" },
  "/api/phishing/integrations/siem/event": { eventType: "phishing_click", campaignId: "{{campaignId}}", metadata: { riskLevel: "high" } },
  "/api/phishing/integrations/opencti/indicator": { name: "Phishing domain", value: "evil.example.com", pattern: "[domain-name:value = 'evil.example.com']", observableType: "Domain-Name" },
  "/api/soar/incidents": { title: "Suspicious login activity", description: "Multiple failed logins from external IP", severity: "high", sourceIP: "203.0.113.50" },
  "/api/soar/playbooks": { name: "Block Malicious IP", description: "Auto-block suspicious IPs", trigger: "manual", actions: [{ type: "block_ip", order: 0, params: { ip: "{{blockedIp}}" } }] },
  "/api/soar/incidents/:id/artifacts": { type: "ip", value: "203.0.113.50", description: "Suspicious source IP" },
  "/api/soar/incidents/:id/notes": { content: "Investigation started by SOC analyst" },
  "/api/soar/webhooks/custom": { alertId: "ext-alert-001", title: "Custom webhook alert", severity: "medium", sourceIp: "10.0.0.99" },
  "/api/soar/connectors": { name: "FortiGate Edge", type: "firewall", config: { host: "{{fortigate_host}}", token: "***" } },
  "/api/soar/vault": { name: "SOAR API Secrets", description: "Encrypted connector credentials" },
  "/api/soar/integrations/grc/finding": { incidentId: "{{incidentId}}", title: "SOAR to GRC finding", description: "Synced from incident", severity: "high", createRisk: true },
  "/api/soar/integrations/firewall/block-ip": { ip: "203.0.113.99", comment: "SOAR automated block", incidentId: "{{incidentId}}" },
  "/api/soar/integrations/edr/isolate-host": { host: "10.0.0.25", os: "linux", incidentId: "{{incidentId}}" },
  "/api/soar/integrations/siem/event": { eventType: "incident_updated", incidentId: "{{incidentId}}", severity: "high", message: "Incident escalated" },
  "/api/uctc/rules": { title: "Suspicious PowerShell", rawSigma: "title: Suspicious PowerShell\nlogsource:\n  product: windows\n  category: process_creation\ndetection:\n  selection:\n    Image|endswith: '\\\\powershell.exe'\n  condition: selection\nlevel: high" },
  "/api/uctc/rules/validate": { rawSigma: "title: Test\nlogsource:\n  product: windows\ndetection:\n  selection:\n    EventID: 1\n  condition: selection" },
  "/api/uctc/rules/convert": { rawSigma: "title: Test\nlogsource:\n  product: windows\ndetection:\n  selection:\n    EventID: 1\n  condition: selection", targets: ["elastic"] },
  "/api/uctc/rules/suggest-from-network": { ip: "10.0.0.15" },
  "/api/uctc/lab/execute-script": { language: "powershell", script: "Get-Process | Select-Object -First 3" },
  "/api/uctc/tuning/alerts/ingest": { rule_id: "{{ruleId}}", outcome: "false_positive", count: 5 },
  "/api/uctc/integrations/grc/gap": { title: "Missing Sysmon rule", description: "No deployed rule for CLIENT01", severity: "medium", sourceId: "gap-sysmon-001" },
  "/api/uctc/integrations/siem/deploy": { ruleId: "{{ruleId}}" },
  "/api/luminet/network/discover": { subnet: "10.0.0.0/24" },
  "/api/luminet/network/scan-ports": { target: "10.0.0.15", ports: [22, 80, 443, 445], scanMode: "CONNECT" },
  "/api/luminet/sniffing/start": { interface: "eth0", duration_sec: 60 },
  "/api/luminet/integrations/grc/finding": { title: "Critical SMB exposure", description: "SMB on management VLAN", severity: "critical", sourceId: "scan-99:smb:10.0.0.8", asset: "10.0.0.8" },
  "/api/luminet/integrations/siem/event": { eventType: "network_scan_complete", target: "10.0.0.0/24", assetCount: 12 }
};

const PATCH_BODIES = {
  "/api/grc/findings/:id": { title: "Updated finding title", severity: "medium" },
  "/api/grc/findings/:id/assign": { assignedTo: "{{userId}}" },
  "/api/grc/findings/:id/close": { resolution: "Remediated and verified" },
  "/api/grc/risks/:id/accept": { justification: "Risk accepted with compensating controls" },
  "/api/grc/tasks/:id/complete": { notes: "Remediation completed" },
  "/api/grc/integrations/soar/tasks/:id": { status: "completed", notes: "Synced from SOAR playbook" },
  "/api/phishing/campaigns/:id": { name: "Updated campaign name" },
  "/api/soar/incidents/:id": { status: "investigating", severity: "critical" },
  "/api/soar/incidents/:id/close": { resolution: "Contained and eradicated threat" },
  "/api/uctc/rules/:ruleId": { description: "Updated rule description" }
};

const QUERY_DEFAULTS = {
  list: { page: 1, limit: 20 },
  "/api/phishing/dashboard/trends": { days: 30 },
  "/api/soar/analytics/kpis": { days: 30 },
  "/api/luminet/assets/inventory": { page: 1, limit: 20 },
  "/api/uctc/tuning/suggestions": { rule_id: "{{ruleId}}" }
};

const TEST_SCRIPT = [
  "pm.test('Status code is valid', function () {",
  "    pm.expect(pm.response.code).to.be.oneOf([200, 201, 202, 204, 400, 401, 403, 404, 422, 502]);",
  "});",
  "pm.test('Response time under 2000ms', function () {",
  "    pm.expect(pm.response.responseTime).to.be.below(2000);",
  "});",
  "if (pm.response.headers.get('Content-Type')?.includes('application/json')) {",
  "    pm.test('Response is JSON', function () { pm.response.to.be.json; });",
  "}"
];

const LOGIN_SCRIPT = [
  "const json = pm.response.json();",
  "if (json?.data?.token) {",
  "  pm.environment.set('jwt_token', json.data.token);",
  "  pm.collectionVariables.set('jwt_token', json.data.token);",
  "}",
  "if (json?.data?.user?._id) {",
  "  pm.environment.set('userId', json.data.user._id);",
  "  pm.collectionVariables.set('userId', json.data.user._id);",
  "}",
  ...TEST_SCRIPT
];

function parseRoutes(filePath) {
  const content = fs.readFileSync(path.join(ROOT, filePath), "utf8");
  const routes = [];
  const regex = /\w+Router\.(get|post|patch|put|delete)\(\s*"([^"]+)"/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    routes.push({ method: match[1].toUpperCase(), subPath: match[2] });
  }
  return routes;
}

function classifyFolder(fullPath, method, module) {
  if (fullPath.includes("/integrations/siem") || fullPath.endsWith("/integrations/siem/alerts") || fullPath.includes("/siem/deploy")) {
    return "06 - SIEM / ELK Integrations";
  }
  if (fullPath.includes("/integrations/opencti") || fullPath.includes("/opencti/")) {
    return "07 - OpenCTI Integrations";
  }
  if (fullPath.includes("/integrations/firewall") || fullPath.includes("/integrations/network/block-ip") ||
      fullPath.includes("/webhooks/fortigate") || fullPath.includes("block-ip")) {
    return "08 - pfSense / Firewall Actions";
  }
  if (fullPath.includes("/integrations/edr") || fullPath.includes("/isolate-host")) {
    return "08 - pfSense / Firewall Actions";
  }
  if (fullPath.startsWith("/api/auth")) return "01 - Authentication";
  if (fullPath.startsWith("/api/grc")) return "02 - GRC Platform";
  if (fullPath.startsWith("/api/phishing")) return "03 - Phishing Simulation";
  if (fullPath.startsWith("/api/soar") && fullPath.includes("/webhooks/")) return "11 - Webhooks / External Ingress";
  if (fullPath.startsWith("/api/soar")) return "04 - SOAR Platform";
  if (fullPath.startsWith("/api/uctc") || fullPath.startsWith("/api/luminet")) return "05 - Network / UCTC";
  if (fullPath.includes("/health") || fullPath.includes("/docs/openapi")) return "10 - System Health / Monitoring";
  return "10 - System Health / Monitoring";
}

function authType(fullPath) {
  if (fullPath === "/api/auth/signup" || fullPath === "/api/auth/login") return "none";
  if (fullPath.includes("/health") || fullPath.includes("/docs/openapi")) return "none";
  if (fullPath.includes("/api/phishing/track/")) return "none";
  if (fullPath.includes("/integrations/")) return "service";
  if (fullPath.includes("/webhooks/")) return "webhook";
  return "jwt";
}

function externalDependency(fullPath) {
  if (fullPath.includes("/siem") || fullPath.includes("/integrations/siem")) return "⚠️ External dependency required: Elasticsearch (ELK)";
  if (fullPath.includes("/opencti")) return "⚠️ External dependency required: OpenCTI";
  if (fullPath.includes("/block-ip") || fullPath.includes("/fortigate") || fullPath.includes("/firewall")) {
    return "⚠️ External dependency required: FortiGate / pfSense";
  }
  if (fullPath.includes("/isolate-host") || fullPath.includes("/edr")) {
    return "⚠️ External dependency required: SSH/WinRM host access";
  }
  if (fullPath.includes("/enrich")) return "⚠️ External dependency required: OpenCTI / enrichment APIs";
  if (fullPath.includes("/lab/execute")) return "⚠️ External dependency required: Docker sandbox (UCTC_SANDBOX_MODE)";
  if (fullPath.includes("/network/discover") || fullPath.includes("/scan-ports") || fullPath.includes("/sniffing")) {
    return "⚠️ External dependency required: LumiNet scanner/sniffer (LUMINET_*_MODE)";
  }
  return null;
}

function toActionName(module, subPath, method) {
  const parts = subPath.split("/").filter(Boolean);
  const last = parts[parts.length - 1] || "resource";
  const verbs = { GET: "Get", POST: "Create", PATCH: "Update", PUT: "Update", DELETE: "Delete" };
  const actionMap = {
    launch: "Launch", pause: "Pause", resume: "Resume", stop: "Stop",
    import: "Import", validate: "Validate", convert: "Convert", deploy: "Deploy",
    archive: "Archive", enrich: "Enrich", close: "Close", assign: "Assign",
    complete: "Complete", verify: "Verify", accept: "Accept", mitigate: "Mitigate",
    generate: "Generate", download: "Download", login: "Login", signup: "Signup"
  };
  const verb = actionMap[last] || verbs[method] || method;
  const resource = parts[0]?.replace(/-/g, " ") || "resource";
  return `[${module}] ${verb} ${resource}`.replace(/\s+/g, " ").trim();
}

function pathToPostman(fullPath) {
  const paramMap = {
    ":id": fullPath.includes("/grc/") ? "{{findingId}}"
      : fullPath.includes("/soar/incidents") ? "{{incidentId}}"
      : fullPath.includes("/phishing/templates") ? "{{templateId}}"
      : fullPath.includes("/phishing/campaigns") ? "{{campaignId}}"
      : fullPath.includes("/connectors") ? "{{connectorId}}"
      : fullPath.includes("/vault") ? "{{vaultId}}"
      : fullPath.includes("/artifacts") ? "{{artifactId}}"
      : fullPath.includes("/alerts") ? "{{alertId}}"
      : "{{id}}",
    ":incidentId": "{{incidentId}}",
    ":campaignId": "{{campaignId}}",
    ":ruleId": "{{ruleId}}",
    ":trackingId": "{{trackingId}}",
    ":mac": "00:1A:2B:3C:4D:5E",
    ":ip": "10.0.0.15",
    ":runId": "{{runId}}",
    ":entityType": "finding",
    ":entityId": "{{findingId}}",
    ":playbookId": "{{playbookId}}"
  };

  return fullPath
    .split("/")
    .filter(Boolean)
    .map((seg) => {
      if (paramMap[seg]) return paramMap[seg];
      if (seg.startsWith(":")) return `{{${seg.slice(1)}}}`;
      return seg;
    });
}

function buildBody(fullPath, method, subPath) {
  const key = fullPath;
  const patchKey = Object.keys(PATCH_BODIES).find((k) => fullPath.match(new RegExp("^" + k.replace(/:[^/]+/g, "[^/]+") + "$")));
  if (method === "PATCH" && patchKey) return PATCH_BODIES[patchKey];
  if (SAMPLE_BODIES[key]) return SAMPLE_BODIES[key];
  const normalized = fullPath.replace(/\/[a-f0-9]{24}/gi, "/:id").replace(/\/[^/]+$/g, (m) => {
    if (m.includes("{{")) return m;
    return "/:id";
  });
  for (const [k, v] of Object.entries(SAMPLE_BODIES)) {
    if (k.replace(/:[^/]+/g, "[^/]+") === normalized.replace(/:[^/]+/g, "[^/]+")) return v;
  }
  if (["POST", "PATCH", "PUT"].includes(method)) {
    const base = subPath.split("/").filter((p) => !p.startsWith(":")).pop();
    return { note: `Sample payload for ${base} — align with Joi validation in source` };
  }
  return null;
}

function buildQuery(fullPath) {
  if (fullPath.match(/\/(findings|risks|tasks|reports|incidents|playbooks|artifacts|alerts|connectors|rules|recipients|campaigns|templates)$/)) {
    return QUERY_DEFAULTS.list;
  }
  for (const [k, v] of Object.entries(QUERY_DEFAULTS)) {
    if (k !== "list" && fullPath.endsWith(k.split("/").pop())) return v;
  }
  if (fullPath.includes("/assets/inventory") || fullPath.includes("/flow-metrics") || fullPath.includes("/misconfigurations")) {
    return QUERY_DEFAULTS.list;
  }
  return null;
}

function makeRequest(route) {
  const { method, fullPath, module, subPath } = route;
  const auth = authType(fullPath);
  const headers = [{ key: "Content-Type", value: "application/json" }];
  if (auth === "jwt" || auth === "webhook") {
    headers.push({ key: "Authorization", value: "Bearer {{jwt_token}}" });
  }
  if (auth === "service") {
    headers.push({ key: "Authorization", value: "Bearer {{jwt_token}}" });
    headers.push({ key: "X-Internal-Api-Key", value: "{{service_api_key}}" });
    headers.push({ key: "x-service-key", value: "{{service_api_key}}", description: "Alias for internal service auth" });
  }
  if (auth === "webhook") {
    headers.push({ key: "x-webhook-signature", value: "{{webhook_signature}}", description: "HMAC when WebhookSource secret configured" });
  }

  const body = buildBody(fullPath, method, subPath);
  const query = method === "GET" ? buildQuery(fullPath) : null;
  const external = externalDependency(fullPath);

  const urlPath = pathToPostman(fullPath);
  const queryParams = query
    ? Object.entries(query).map(([key, value]) => ({ key, value: String(value) }))
    : [];

  const request = {
    name: toActionName(module, subPath, method),
    request: {
      method,
      header: headers,
      url: {
        raw: `{{api_gateway_url}}${fullPath}${queryParams.length ? "?" + queryParams.map((q) => `${q.key}=${q.value}`).join("&") : ""}`,
        host: ["{{api_gateway_url}}"],
        path: urlPath,
        query: queryParams
      },
      description: [
        `**Module:** ${module}`,
        `**Route:** \`${method} ${fullPath}\``,
        `**Auth:** ${auth === "none" ? "Public" : auth === "service" ? "JWT or X-Internal-Api-Key" : auth === "webhook" ? "JWT + optional webhook signature" : "Bearer JWT"}`,
        external ? `\n${external}` : "",
        route.tags?.length ? `\n**Tags:** ${route.tags.join(", ")}` : ""
      ].filter(Boolean).join("\n")
    },
    event: [{
      listen: "test",
      script: {
        type: "text/javascript",
        exec: fullPath === "/api/auth/login" || fullPath === "/api/auth/signup" ? LOGIN_SCRIPT : TEST_SCRIPT
      }
    }]
  };

  if (body && ["POST", "PATCH", "PUT"].includes(method)) {
    request.request.body = { mode: "raw", raw: JSON.stringify(body, null, 2) };
  }

  if (fullPath.includes("/findings") && method === "POST" && fullPath === "/api/grc/findings") {
    request.event[0].script.exec.push(
      "const j = pm.response.json(); if (j?.data?._id) { pm.collectionVariables.set('findingId', j.data._id); pm.environment.set('findingId', j.data._id); }"
    );
  }
  if (fullPath === "/api/soar/incidents" && method === "POST") {
    request.event[0].script.exec.push(
      "const j = pm.response.json(); if (j?.data?._id) { pm.collectionVariables.set('incidentId', j.data._id); pm.environment.set('incidentId', j.data._id); }"
    );
  }
  if (fullPath === "/api/phishing/campaigns" && method === "POST") {
    request.event[0].script.exec.push(
      "const j = pm.response.json(); if (j?.data?._id) { pm.collectionVariables.set('campaignId', j.data._id); pm.environment.set('campaignId', j.data._id); }"
    );
  }
  if (fullPath === "/api/phishing/templates" && method === "POST") {
    request.event[0].script.exec.push(
      "const j = pm.response.json(); if (j?.data?._id) { pm.collectionVariables.set('templateId', j.data._id); pm.environment.set('templateId', j.data._id); }"
    );
  }
  if (fullPath === "/api/uctc/rules" && method === "POST") {
    request.event[0].script.exec.push(
      "const j = pm.response.json(); if (j?.data?._id) { pm.collectionVariables.set('ruleId', j.data._id); pm.environment.set('ruleId', j.data._id); }"
    );
  }

  return request;
}

// Collect all routes
const allRoutes = [];

for (const router of ROUTERS) {
  const parsed = parseRoutes(router.file);
  for (const r of parsed) {
    allRoutes.push({
      method: r.method,
      subPath: r.subPath,
      fullPath: `${router.prefix}${r.subPath}`,
      module: router.module
    });
  }
}

for (const r of BOOTSTRAP_ROUTES) {
  allRoutes.push({ ...r, subPath: r.path, fullPath: r.path });
}

// Deduplicate by method+fullPath
const seen = new Set();
const uniqueRoutes = allRoutes.filter((r) => {
  const key = `${r.method} ${r.fullPath}`;
  if (seen.has(key)) return false;
  seen.add(key);
  return true;
});

// Tag critical endpoints
for (const r of uniqueRoutes) {
  r.tags = [];
  if (r.fullPath.includes("/integrations/")) r.tags.push("integration");
  if (r.fullPath.startsWith("/api/grc/findings") || r.fullPath.startsWith("/api/grc/risks")) r.tags.push("grc-core", "critical");
  if (r.fullPath.startsWith("/api/soar/incidents")) r.tags.push("soar-core", "critical");
  if (r.fullPath.includes("/siem")) r.tags.push("siem");
}

// Group into folders
const folderMap = new Map();
for (const route of uniqueRoutes) {
  const folder = classifyFolder(route.fullPath, route.method, route.module);
  if (!folderMap.has(folder)) folderMap.set(folder, []);
  folderMap.get(folder).push(makeRequest(route));
}

const FOLDER_ORDER = [
  "01 - Authentication",
  "02 - GRC Platform",
  "03 - Phishing Simulation",
  "04 - SOAR Platform",
  "05 - Network / UCTC",
  "06 - SIEM / ELK Integrations",
  "07 - OpenCTI Integrations",
  "08 - pfSense / Firewall Actions",
  "09 - Active Directory (DC01)",
  "10 - System Health / Monitoring",
  "11 - Webhooks / External Ingress"
];

const FOLDER_DESCRIPTIONS = {
  "01 - Authentication": "User signup, login, and profile. Run Login first to populate {{jwt_token}}.",
  "02 - GRC Platform": "Governance, Risk & Compliance — findings, risks, tasks, evidence, audit reports, compliance controls. **Tags: grc-core, critical**",
  "03 - Phishing Simulation": "Templates, campaigns, recipients, tracking pixels, reports, and dashboards.",
  "04 - SOAR Platform": "Incidents, playbooks, artifacts, connectors, vault, analytics. **Tags: soar-core, critical**",
  "05 - Network / UCTC": "LumiNet discovery/scanning and UCTC Sigma rule builder, sandbox, tuning.",
  "06 - SIEM / ELK Integrations": "Cross-module Elasticsearch event forwarding. **⚠️ Requires ELASTICSEARCH_URL**",
  "07 - OpenCTI Integrations": "IOC push/pull and enrichment. **⚠️ Requires OPENCTI_URL + OPENCTI_TOKEN**",
  "08 - pfSense / Firewall Actions": "IP blocking and host isolation via FortiGate/pfSense and EDR connectors. **⚠️ Requires firewall/VM credentials**",
  "09 - Active Directory (DC01)": "No dedicated AD/LDAP REST endpoints exist in the current codebase. AD remediation is planned via SOAR connector actions (LDAP) — configure connectors in SOAR module.",
  "10 - System Health / Monitoring": "Health checks, OpenAPI specs, dashboards, and analytics KPIs.",
  "11 - Webhooks / External Ingress": "Inbound webhook endpoints for CrowdStrike, FortiGate, Wazuh, Defender, Splunk, and custom alerts."
};

const items = FOLDER_ORDER.map((name) => ({
  name,
  description: FOLDER_DESCRIPTIONS[name] || "",
  item: name === "09 - Active Directory (DC01)"
    ? [{
        name: "[AD] Placeholder — No REST route in codebase",
        request: {
          method: "GET",
          header: [{ key: "Content-Type", value: "application/json" }],
          url: {
            raw: "{{api_gateway_url}}/api/soar/connectors",
            host: ["{{api_gateway_url}}"],
            path: ["api", "soar", "connectors"]
          },
          description: "Active Directory actions are not exposed as standalone REST routes. Use SOAR playbook actions and connector framework with DC01 LDAP credentials (planned)."
        },
        event: [{ listen: "test", script: { type: "text/javascript", exec: TEST_SCRIPT } }]
      }]
    : (folderMap.get(name) || []).sort((a, b) => a.name.localeCompare(b.name))
}));

const collection = {
  info: {
    _postman_id: randomUUID(),
    name: "LumiSec APIs",
    description: "Enterprise Postman collection for the LumiSec monolith (GRC, Phishing, SOAR, UCTC, LumiNet).\n\n**Setup:**\n1. Import `LumiSec_Environment.json`\n2. Set `api_gateway_url` (default http://localhost:3000)\n3. Run **01 - Authentication → [Auth] Create login** to set `jwt_token`\n4. For integration routes, set `service_api_key` (INTERNAL_API_KEY from config/.env)\n\nGenerated from Express routers — {{total}} endpoints.",
    schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  variable: [
    { key: "api_gateway_url", value: "http://localhost:3000" },
    { key: "jwt_token", value: "" },
    { key: "service_api_key", value: "" },
    { key: "userId", value: "" },
    { key: "findingId", value: "" },
    { key: "incidentId", value: "" },
    { key: "campaignId", value: "" },
    { key: "templateId", value: "" },
    { key: "ruleId", value: "" },
    { key: "trackingId", value: "abc123trackingid01" },
    { key: "webhook_signature", value: "" },
    { key: "fortigate_host", value: "192.168.1.1" },
    { key: "blockedIp", value: "203.0.113.99" }
  ],
  item: items
};

collection.info.description = collection.info.description.replace("{{total}}", String(uniqueRoutes.length));

const environment = {
  id: randomUUID(),
  name: "LumiSec Environment",
  values: [
    { key: "api_gateway_url", value: "http://localhost:3000", type: "default", enabled: true },
    { key: "base_url_grc", value: "http://localhost:3000/api/grc", type: "default", enabled: true },
    { key: "base_url_phishing", value: "http://localhost:3000/api/phishing", type: "default", enabled: true },
    { key: "base_url_soar", value: "http://localhost:3000/api/soar", type: "default", enabled: true },
    { key: "base_url_network", value: "http://localhost:3000/api/luminet", type: "default", enabled: true },
    { key: "base_url_uctc", value: "http://localhost:3000/api/uctc", type: "default", enabled: true },
    { key: "base_url_siem", value: "http://localhost:9200", type: "default", enabled: true },
    { key: "base_url_opencti", value: "http://localhost:8080", type: "default", enabled: true },
    { key: "jwt_token", value: "", type: "secret", enabled: true },
    { key: "service_api_key", value: "", type: "secret", enabled: true },
    { key: "userId", value: "", type: "default", enabled: true },
    { key: "findingId", value: "", type: "default", enabled: true },
    { key: "incidentId", value: "", type: "default", enabled: true },
    { key: "campaignId", value: "", type: "default", enabled: true },
    { key: "templateId", value: "", type: "default", enabled: true },
    { key: "ruleId", value: "", type: "default", enabled: true },
    { key: "trackingId", value: "abc123trackingid01", type: "default", enabled: true }
  ],
  _postman_variable_scope: "environment"
};

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(path.join(OUT_DIR, "LumiSec_Enterprise_Collection.json"), JSON.stringify(collection, null, 2));
fs.writeFileSync(path.join(OUT_DIR, "LumiSec_Environment.json"), JSON.stringify(environment, null, 2));

const summary = {
  totalEndpoints: uniqueRoutes.length,
  folders: Object.fromEntries(FOLDER_ORDER.map((f) => [f, (folderMap.get(f) || []).length])),
  output: ["postman/LumiSec_Enterprise_Collection.json", "postman/LumiSec_Environment.json"]
};

console.log(JSON.stringify(summary, null, 2));
