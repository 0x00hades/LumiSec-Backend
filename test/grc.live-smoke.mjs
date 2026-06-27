/**
 * Live GRC smoke test — hits http://localhost:3000 (real MongoDB).
 * Run: node test/grc.live-smoke.mjs
 */
const BASE = process.env.SMOKE_BASE_URL || "http://localhost:3000";
const ts = Date.now();
const adminEmail = `smoke-admin-${ts}@lumisec.io`;
const PASSWORD = "SmokeTest123";

const results = [];

function record(name, pass, detail = "") {
  results.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}

async function req(method, path, { token, body } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    data = {};
  }
  return { status: res.status, data, ok: res.ok };
}

async function run() {
  console.log(`\nGRC Live Smoke Test → ${BASE}\n`);

  const health = await req("GET", "/health");
  record("Health check", health.ok && health.data?.status === "ok", `status ${health.status}`);

  const signup = await req("POST", "/api/auth/signup", {
    body: {
      name: "Smoke Admin",
      email: adminEmail,
      password: PASSWORD,
      role: "admin",
      department: "GRC",
    },
  });
  const token = signup.data?.data?.token;
  record(
    "Auth signup (admin)",
    signup.status === 201 && Boolean(token),
    signup.data?.message || `status ${signup.status}`
  );
  if (!token) {
    printSummary();
    process.exit(1);
  }

  const profileGet = await req("GET", "/api/auth/profile", { token });
  record(
    "Profile GET",
    profileGet.ok && profileGet.data?.data?.email === adminEmail,
    profileGet.data?.message
  );

  const profilePatch = await req("PATCH", "/api/auth/profile", {
    token,
    body: { name: "Smoke Admin Updated" },
  });
  record(
    "Profile PATCH",
    profilePatch.ok && profilePatch.data?.data?.name === "Smoke Admin Updated",
    profilePatch.data?.message
  );

  const dashOverview = await req("GET", "/api/grc/dashboard/overview", { token });
  record("Dashboard overview", dashOverview.ok, dashOverview.data?.message);

  const control = await req("POST", "/api/grc/compliance/controls", {
    token,
    body: {
      framework: "ISO27001",
      controlId: `SMK-${ts}`,
      title: "Smoke test control",
      description: "Created by live smoke test",
      status: "not_assessed",
    },
  });
  const controlId = control.data?.data?._id;
  record("Standards — create control", control.status === 201 && Boolean(controlId), control.data?.message);

  const finding = await req("POST", "/api/grc/findings", {
    token,
    body: {
      title: "Smoke finding",
      description: "Gap found during smoke test",
      severity: "medium",
      riskRating: "medium",
      asset: "smoke-app",
    },
  });
  const findingId = finding.data?.data?._id;
  record("Audits — create finding", finding.status === 201 && Boolean(findingId), finding.data?.message);

  const report = await req("POST", "/api/grc/reports", {
    token,
    body: {
      title: `Smoke Report ${ts}`,
      framework: "ISO27001",
      scope: "Smoke test scope",
      summary: "Automated smoke test report",
      findings: findingId ? [findingId] : undefined,
    },
  });
  const reportId = report.data?.data?._id;
  record("Audits — create report", report.status === 201 && Boolean(reportId), report.data?.message);

  const assignees = await req("GET", "/api/grc/users/assignees", { token });
  const assigneeId = assignees.data?.data?.[0]?._id;
  record(
    "Assignees list",
    assignees.ok && Array.isArray(assignees.data?.data) && assignees.data.data.length > 0,
    `${assignees.data?.data?.length ?? 0} users`
  );

  const task = await req("POST", "/api/grc/tasks", {
    token,
    body: {
      findingId,
      title: "Remediate smoke finding",
      description: "Close the smoke test gap",
      assignedTo: assigneeId || signup.data?.data?.user?._id,
      priority: "medium",
    },
  });
  const taskId = task.data?.data?._id;
  record("Remediation — create task", task.status === 201 && Boolean(taskId), task.data?.message);

  if (taskId) {
    const taskPatch = await req("PATCH", `/api/grc/tasks/${taskId}`, {
      token,
      body: { id: taskId, status: "in_progress" },
    });
    record("Remediation — update task", taskPatch.ok, taskPatch.data?.message);
  }

  const users = await req("GET", "/api/grc/users", { token });
  record(
    "User management — list users",
    users.ok && Array.isArray(users.data?.data),
    `${users.data?.data?.length ?? 0} users`
  );

  const newUser = await req("POST", "/api/grc/users", {
    token,
    body: {
      name: "Smoke Assignee",
      email: `smoke-assignee-${ts}@lumisec.io`,
      password: PASSWORD,
      role: "assignee",
      department: "GRC",
    },
  });
  record("User management — create user", newUser.status === 201, newUser.data?.message);

  if (reportId) {
    const generate = await req("POST", `/api/grc/reports/${reportId}/generate`, {
      token,
      body: { id: reportId },
    });
    record(
      "Audits — queue report PDF",
      generate.ok,
      generate.data?.data?.status === "generating" ? "queued (worker required for completion)" : generate.data?.message
    );
  }

  printSummary();
  process.exit(results.every((r) => r.pass) ? 0 : 1);
}

function printSummary() {
  const passed = results.filter((r) => r.pass).length;
  const failed = results.filter((r) => !r.pass);
  console.log(`\n--- Summary: ${passed}/${results.length} passed ---`);
  if (failed.length) {
    console.log("Failed:");
    failed.forEach((r) => console.log(`  - ${r.name}: ${r.detail}`));
  }
}

run().catch((err) => {
  console.error("Smoke test crashed:", err.message);
  process.exit(1);
});
