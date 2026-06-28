import express from "express";

const PORT = Number(process.env.LUMINET_SNIFFER_PORT || 4200);

const PROTOCOLS = ["TCP", "UDP", "DNS", "TLS", "ICMP"];
const PRIVATE_SOURCES = ["10.0.0.5", "192.168.1.42", "172.16.0.8"];
const PRIVATE_DESTS = ["10.0.0.20", "192.168.1.1", "8.8.8.8"];

const buildMockPackets = ({ interfaceName, durationSec, filter, count = 12 }) => {
  const packets = [];
  const sampleCount = Math.min(Math.max(Math.floor(durationSec / 2), 4), count);

  for (let i = 0; i < sampleCount; i += 1) {
    const protocol = PROTOCOLS[i % PROTOCOLS.length];
    const srcIp = PRIVATE_SOURCES[i % PRIVATE_SOURCES.length];
    const dstIp = PRIVATE_DESTS[i % PRIVATE_DESTS.length];
    const srcPort = 40000 + i * 137;
    const dstPort = protocol === "DNS" ? 53 : protocol === "TLS" ? 443 : 80 + (i % 3);

    packets.push({
      timestamp: new Date(Date.now() - (sampleCount - i) * 250).toISOString(),
      interface: interfaceName || "eth0",
      filter: filter || "ip",
      src_ip: srcIp,
      dst_ip: dstIp,
      protocol,
      src_port: srcPort,
      dst_port: dstPort,
      size: 256 + i * 48,
      suspicious: protocol === "TCP" && dstPort === 23,
    });
  }

  if (filter && filter !== "ip") {
    return packets.filter((p) => p.protocol.toLowerCase().includes(filter.split(" ")[0]) || filter.includes(String(p.dst_port)));
  }

  return packets;
};

const app = express();
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "LumiNet Sniffer Worker", port: PORT });
});

app.post("/sniffing/start", (req, res) => {
  const { interfaceName = "eth0", durationSec = 30, filter = "ip" } = req.body || {};
  const seedCount = Math.min(3, Math.max(Math.floor(durationSec / 20), 2));
  const packets = buildMockPackets({ interfaceName, durationSec, filter, count: seedCount });

  res.json({
    runnerJobId: `sniff-${Date.now()}`,
    status: "running",
    packets,
  });
});

app.listen(PORT, () => {
  console.log(`LumiNet sniffer worker listening on http://localhost:${PORT}`);
}).on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(`Port ${PORT} is already in use — sniffer worker is likely already running.`);
    console.error(`Health check: http://localhost:${PORT}/health`);
    process.exit(0);
  }
  throw err;
});
