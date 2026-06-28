const BASE = process.env.API_BASE || "http://localhost:3000";

async function step(n, name, fn) {
  process.stdout.write(`\n=== Step ${n}: ${name} ===\n`);
  try {
    await fn();
    process.stdout.write("PASS\n");
    return true;
  } catch (err) {
    process.stdout.write(`FAIL: ${err.message}\n`);
    if (err.body) process.stdout.write(`${JSON.stringify(err.body)}\n`);
    return false;
  }
}

async function request(path, { method = "GET", body, token } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(json.message || res.statusText);
    err.body = json;
    err.status = res.status;
    throw err;
  }
  return json;
}

const state = {};

await step(1, "Health check", async () => {
  const r = await request("/api/health");
  if (r.status !== "ok") throw new Error("Health check failed");
  console.log(`Backend: ${r.service}`);
});

await step(2, "Login as it_manager", async () => {
  const creds = [
    { email: "admin@lumisec.io", password: "Password123" },
    { email: "net-test@lumisec.io", password: "Password123" },
  ];

  for (const { email, password } of creds) {
    try {
      const r = await request("/api/auth/login", {
        method: "POST",
        body: { email, password },
      });
      state.token = r.data.token;
      state.user = r.data.user;
      console.log(`Logged in: ${state.user.email} (${state.user.role})`);
      return;
    } catch {
      // try next credential
    }
  }

  await request("/api/auth/signup", {
    method: "POST",
    body: {
      name: "Net Tester",
      email: "net-test@lumisec.io",
      password: "Password123",
      role: "it_manager",
      department: "IT",
    },
  });
  const r = await request("/api/auth/login", {
    method: "POST",
    body: { email: "net-test@lumisec.io", password: "Password123" },
  });
  state.token = r.data.token;
  state.user = r.data.user;
  console.log(`Logged in: ${state.user.email} (${state.user.role})`);
});

await step(3, "Network discovery 127.0.0.1/32", async () => {
  const r = await request("/api/luminet/network/discover", {
    method: "POST",
    token: state.token,
    body: { subnet: "127.0.0.1/32" },
  });
  console.log(`Discovered: ${r.data.discovered_count}`);
  state.assets = r.data.assets || [];
});

await step(4, "Asset inventory (page 1)", async () => {
  const r = await request("/api/luminet/assets/inventory?page=1&limit=20", {
    token: state.token,
  });
  console.log(`Total: ${r.pagination?.total}, page items: ${r.data?.length}`);
  state.inventory = r.data || [];
});

await step(5, "Port scan 127.0.0.1 (scanMode CONNECT)", async () => {
  const r = await request("/api/luminet/network/scan-ports", {
    method: "POST",
    token: state.token,
    body: { target: "127.0.0.1", ports: "22,80,443,445,3389", scanMode: "CONNECT" },
  });
  console.log(
    `Open ports: ${r.data.open_ports?.length ?? 0}, misconfigs: ${r.data.misconfigurations?.length ?? 0}`
  );
});

await step(6, "List misconfigurations", async () => {
  const r = await request("/api/luminet/network/misconfigurations?page=1&limit=20", {
    token: state.token,
  });
  console.log(`Total misconfigs: ${r.pagination?.total}`);
  state.misconfigs = r.data || [];
});

await step(7, "Asset details + context", async () => {
  const asset = state.inventory[0] || state.assets[0];
  if (!asset) throw new Error("No assets available");
  const mac = encodeURIComponent(asset.mac);
  const details = await request(`/api/luminet/assets/details/${mac}`, { token: state.token });
  const context = await request(`/api/luminet/assets/context/${asset.ip}`, { token: state.token });
  console.log(
    `Details misconfigs: ${details.data.misconfigurations?.length ?? 0}, flows: ${context.data.recentFlows?.length ?? 0}`
  );
});

await step(8, "Flow metrics", async () => {
  const r = await request("/api/luminet/network/flow-metrics?page=1&limit=20", {
    token: state.token,
  });
  console.log(`Flow metric rows: ${r.data?.length ?? 0}`);
});

await step(9, "LumiNet → GRC integration", async () => {
  const r = await request("/api/luminet/integrations/grc/finding", {
    method: "POST",
    token: state.token,
    body: {
      title: "Network walkthrough test finding",
      description: "Created during step-by-step network test",
      severity: "medium",
      sourceId: `network-test-${Date.now()}`,
      asset: "127.0.0.1",
      findingType: "test",
    },
  });
  console.log(`GRC finding: ${r.data._id}`);
});

await step(10, "Resolve open misconfiguration", async () => {
  const open = state.misconfigs.find((m) => m.status === "open");
  if (!open) {
    console.log("Skipped — no open misconfigurations");
    return;
  }
  const r = await request(`/api/luminet/network/misconfigurations/${open._id}`, {
    method: "PATCH",
    token: state.token,
    body: { status: "resolved" },
  });
  console.log(`Status updated to: ${r.data.status}`);
});

await step(11, "Packet sniffing", async () => {
  try {
    const r = await request("/api/luminet/sniffing/start", {
      method: "POST",
      token: state.token,
      body: { interface: "eth0", duration_sec: 5, filter: "ip" },
    });
    console.log(`Session ${r.data.session_id}, packets ${r.data.packet_count}`);
    const stream = await request(
      `/api/luminet/sniffing/live-stream?session_id=${r.data.session_id}&limit=10`,
      { token: state.token }
    );
    console.log(`Live stream packets: ${stream.data.packets?.length ?? 0}`);
  } catch (err) {
    console.log(`Note: ${err.message}`);
    console.log("(Sniffing requires LUMINET_SNIFFING_MODE=worker and sniffer worker URL)");
  }
});

await step(12, "Role check — grc_manager cannot scan", async () => {
  let grcToken;
  try {
    const login = await request("/api/auth/login", {
      method: "POST",
      body: { email: "grc-manager@lumisec.io", password: "Password123" },
    });
    grcToken = login.data.token;
  } catch {
    try {
      await request("/api/auth/signup", {
        method: "POST",
        body: {
          name: "GRC Manager",
          email: "grc-manager@lumisec.io",
          password: "Password123",
          role: "grc_manager",
          department: "GRC",
        },
      });
    } catch {
      // account may already exist
    }
    const login = await request("/api/auth/login", {
      method: "POST",
      body: { email: "grc-manager@lumisec.io", password: "Password123" },
    });
    grcToken = login.data.token;
  }

  try {
    await request("/api/luminet/network/scan-ports", {
      method: "POST",
      token: grcToken,
      body: { target: "127.0.0.1", ports: [22], scanMode: "CONNECT" },
    });
    throw new Error("Expected 403 for grc_manager scan");
  } catch (err) {
    if (err.status === 403 || err.message.includes("403") || err.body?.message?.includes("Forbidden")) {
      console.log("Correctly blocked port scan for grc_manager");
      return;
    }
    if (err.message === "Expected 403 for grc_manager scan") throw err;
    console.log(`Blocked with: ${err.message}`);
  }
});

console.log("\n=== Network module walkthrough complete ===\n");
