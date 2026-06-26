import net from "net";
import os from "os";
import { spawn } from "child_process";
import axios from "axios";
import { normalizePortsInput } from "./networkPortUtils.js";

const serviceByPort = {
    22: "ssh",
    23: "telnet",
    53: "dns",
    80: "http",
    135: "msrpc",
    139: "netbios",
    443: "https",
    445: "smb",
    3389: "rdp",
    5985: "winrm"
};

const TCP_ALIVE_PROBE_PORTS = [22, 80, 443, 445, 3389];

/**
 * Returns the configured LumiNet scan provider (local | worker | cloud).
 */
const getScanMode = () => process.env.LUMINET_SCAN_MODE || "local";

/**
 * Returns the configured LumiNet packet-capture provider (worker | cloud).
 */
const getSniffingMode = () => process.env.LUMINET_SNIFFING_MODE || "worker";

export const getConfiguredScanMode = () => getScanMode();
export const getConfiguredSniffingMode = () => getSniffingMode();

/**
 * Converts an IPv4 address into an integer for CIDR host enumeration.
 */
const ipToNumber = (ip) => {
    return ip.split(".").reduce((total, part) => ((total << 8) + Number(part)) >>> 0, 0);
};

/**
 * Converts an integer back into an IPv4 address.
 */
const numberToIp = (value) => {
    return [24, 16, 8, 0].map((shift) => (value >>> shift) & 255).join(".");
};

/**
 * Enumerates hosts in a CIDR range with a safety cap for local scanning.
 */
const enumerateCidrHosts = (subnet) => {
    const [baseIp, prefixText] = subnet.split("/");
    const prefix = Number(prefixText);
    const maxHosts = Number(process.env.LUMINET_MAX_DISCOVERY_HOSTS) || 256;
    const hostCount = Math.max(0, Math.min((2 ** (32 - prefix)) - 2, maxHosts));
    const base = ipToNumber(baseIp);
    const mask = prefix === 0 ? 0 : (0xFFFFFFFF << (32 - prefix)) >>> 0;
    const network = base & mask;

    return Array.from({ length: hostCount }, (_, index) => numberToIp(network + index + 1));
};

/**
 * Builds a stable locally administered MAC-like identifier when ARP cannot resolve a real MAC.
 */
const fallbackMacFromIp = (ip) => {
    const octets = ip.split(".").map((part) => Number(part).toString(16).padStart(2, "0").toUpperCase());
    return `02:00:${octets.join(":")}`;
};

/**
 * Runs a child process safely without shell interpolation.
 */
const runProcess = (command, args, timeoutMs = 2000) => {
    return new Promise((resolve) => {
        let stdout = "";
        let stderr = "";

        const child = spawn(command, args, { windowsHide: true });
        const timer = setTimeout(() => {
            child.kill("SIGKILL");
        }, timeoutMs);

        child.stdout.on("data", (chunk) => {
            stdout += chunk.toString();
        });

        child.stderr.on("data", (chunk) => {
            stderr += chunk.toString();
        });

        child.on("error", (error) => {
            clearTimeout(timer);
            resolve({ exitCode: null, stdout, stderr: error.message });
        });

        child.on("close", (exitCode) => {
            clearTimeout(timer);
            resolve({ exitCode, stdout, stderr });
        });
    });
};

/**
 * Checks whether one host responds to local ICMP ping.
 */
const pingHost = async (ip) => {
    const timeoutMs = Number(process.env.LUMINET_PING_TIMEOUT_MS) || 1000;
    const args = os.platform() === "win32"
        ? ["-n", "1", "-w", String(timeoutMs), ip]
        : ["-c", "1", "-W", String(Math.max(1, Math.ceil(timeoutMs / 1000))), ip];
    const result = await runProcess("ping", args, timeoutMs + 1000);
    return result.exitCode === 0;
};

/**
 * Reads the local ARP cache and extracts a MAC address for one IP when available.
 */
const resolveMacFromArp = async (ip) => {
    const result = await runProcess("arp", ["-a"], 2000);
    const escapedIp = ip.replace(/\./g, "\\.");
    const regexes = [
        new RegExp(`${escapedIp}\\s+([0-9a-fA-F:-]{17})`),
        new RegExp(`\\(${escapedIp}\\)\\s+at\\s+([0-9a-fA-F:-]{17})`)
    ];

    for (const regex of regexes) {
        const match = result.stdout.match(regex);
        if (match?.[1]) return match[1].replace(/-/g, ":").toUpperCase();
    }

    return null;
};

/**
 * Checks one TCP port with a real local connect scan.
 */
const checkTcpPort = (target, port) => {
    const timeoutMs = Number(process.env.LUMINET_CONNECT_TIMEOUT_MS) || 1200;

    return new Promise((resolve) => {
        const socket = new net.Socket();
        let resolved = false;

        const finish = (isOpen) => {
            if (resolved) return;
            resolved = true;
            socket.destroy();
            resolve(isOpen);
        };

        socket.setTimeout(timeoutMs);
        socket.once("connect", () => finish(true));
        socket.once("timeout", () => finish(false));
        socket.once("error", () => finish(false));
        socket.connect(port, target);
    });
};

/**
 * Probes common TCP ports when ICMP is blocked.
 */
const probeTcpAlive = async (ip) => {
    for (const port of TCP_ALIVE_PROBE_PORTS) {
        if (await checkTcpPort(ip, port)) return { alive: true, method: "tcp_connect", port };
    }
    return { alive: false };
};

/**
 * Determines host liveness using ICMP first, then TCP connect probes.
 */
const isHostAlive = async (ip) => {
    if (await pingHost(ip)) return { alive: true, method: "icmp" };
    return probeTcpAlive(ip);
};

/**
 * Attempts to read a service banner after a successful TCP connect.
 */
const grabTcpBanner = async (target, port) => {
    const timeoutMs = Number(process.env.LUMINET_BANNER_TIMEOUT_MS) || 2000;

    return new Promise((resolve) => {
        const socket = new net.Socket();
        let banner = "";
        let settled = false;

        const finish = (value) => {
            if (settled) return;
            settled = true;
            socket.destroy();
            resolve(value);
        };

        socket.setTimeout(timeoutMs);
        socket.once("connect", () => {
            if (port === 80 || port === 8080) {
                socket.write(`HEAD / HTTP/1.0\r\nHost: ${target}\r\n\r\n`);
            } else if (port === 22) {
                // SSH servers send banner immediately on connect.
            } else if (port === 25) {
                // SMTP servers send banner immediately on connect.
            }
        });
        socket.on("data", (chunk) => {
            banner += chunk.toString("utf8", 0, Math.min(chunk.length, 512));
            finish(banner.trim());
        });
        socket.once("timeout", () => finish(banner.trim()));
        socket.once("error", () => finish(""));
        socket.connect(port, target);
    });
};

/**
 * Maps one live IP into the asset shape used by the database model.
 */
const buildDiscoveredAsset = async (ip, subnet, discoveryMethod) => {
    const mac = await resolveMacFromArp(ip);
    return {
        ip,
        mac: mac || fallbackMacFromIp(ip),
        hostname: null,
        osType: "unknown",
        vendor: mac ? "unknown" : "unresolved",
        status: "active",
        metadata: {
            discoveryMethod,
            sourceSubnet: subnet,
            macSource: mac ? "arp" : "fallback"
        }
    };
};

/**
 * Runs local ICMP/TCP discovery for a CIDR range.
 */
const discoverWithLocalPing = async (subnet) => {
    const hosts = enumerateCidrHosts(subnet);
    const concurrency = Number(process.env.LUMINET_SCAN_CONCURRENCY) || 32;
    const discovered = [];

    for (let index = 0; index < hosts.length; index += concurrency) {
        const batch = hosts.slice(index, index + concurrency);
        const results = await Promise.all(batch.map(async (ip) => ({
            ip,
            liveness: await isHostAlive(ip)
        })));

        for (const result of results) {
            if (!result.liveness.alive) continue;
            const method = result.liveness.method === "tcp_connect"
                ? `tcp_connect:${result.liveness.port}`
                : result.liveness.method;
            discovered.push(await buildDiscoveredAsset(result.ip, subnet, method));
        }
    }

    return discovered;
};

/**
 * Runs a local TCP connect scan with optional banner grabbing.
 */
const scanWithLocalTcp = async ({ target, ports }) => {
    const requestedPorts = normalizePortsInput(ports);
    const concurrency = Number(process.env.LUMINET_SCAN_CONCURRENCY) || 64;
    const openPorts = [];

    for (let index = 0; index < requestedPorts.length; index += concurrency) {
        const batch = requestedPorts.slice(index, index + concurrency);
        const results = await Promise.all(batch.map(async (port) => ({
            port,
            isOpen: await checkTcpPort(target, port)
        })));

        for (const result of results) {
            if (!result.isOpen) continue;
            const banner = await grabTcpBanner(target, result.port);
            openPorts.push({
                port: result.port,
                protocol: "tcp",
                service: serviceByPort[result.port] || "unknown",
                banner,
                state: "open",
                detectedAt: new Date()
            });
        }
    }

    const mac = await resolveMacFromArp(target);
    return {
        ip: target,
        mac: mac || fallbackMacFromIp(target),
        hostname: null,
        osType: "unknown",
        vendor: mac ? "unknown" : "unresolved",
        status: "active",
        openPorts,
        metadata: {
            scanMethod: "local_tcp_connect",
            macSource: mac ? "arp" : "fallback",
            bannerGrabbing: true
        }
    };
};

/**
 * Calls the external scanner worker service.
 */
const callScannerWorker = async (path, payload) => {
    const baseUrl = process.env.LUMINET_SCANNER_WORKER_URL;
    if (!baseUrl) {
        throw new Error("LUMINET_SCANNER_WORKER_URL is not configured for worker/cloud scan mode");
    }
    const { data } = await axios.post(`${baseUrl}${path}`, payload, {
        timeout: Number(process.env.LUMINET_SCAN_TIMEOUT_SEC || 60) * 1000
    });
    return data;
};

/**
 * Calls the external sniffer worker service.
 */
const callSnifferWorker = async (path, payload) => {
    const baseUrl = process.env.LUMINET_SNIFFER_WORKER_URL;
    if (!baseUrl) {
        throw new Error("LUMINET_SNIFFER_WORKER_URL is not configured for worker/cloud sniffing mode");
    }
    const { data } = await axios.post(`${baseUrl}${path}`, payload, {
        timeout: Number(process.env.LUMINET_SCAN_TIMEOUT_SEC || 60) * 1000
    });
    return data;
};

const assertDiscoveryWorkerResult = (result) => {
    if (!Array.isArray(result?.assets)) {
        throw new Error("Scanner worker returned an invalid discovery response: assets array is required");
    }
};

const assertPortScanWorkerResult = (result) => {
    if (!result?.asset?.ip || !result.asset.mac) {
        throw new Error("Scanner worker returned an invalid port-scan response: asset ip and mac are required");
    }
    if (!Array.isArray(result.asset.openPorts)) {
        result.asset.openPorts = [];
    }
};

const assertSnifferWorkerResult = (result) => {
    if (result?.packets !== undefined && !Array.isArray(result.packets)) {
        throw new Error("Sniffer worker returned an invalid response: packets must be an array");
    }
};

/**
 * Discovers hosts using local ICMP/TCP probes or an external scanner worker.
 */
export const discoverHosts = async ({ subnet }) => {
    const mode = getScanMode();
    if (mode === "local") {
        return { runnerProvider: "local_ping_tcp", assets: await discoverWithLocalPing(subnet) };
    }
    if (mode === "worker" || mode === "cloud") {
        const result = await callScannerWorker("/discover", { subnet });
        assertDiscoveryWorkerResult(result);
        return {
            runnerProvider: mode,
            runnerJobId: result.runnerJobId,
            assets: result.assets
        };
    }
    throw new Error(`Unsupported LUMINET_SCAN_MODE: ${mode}. Supported values: local, worker, cloud`);
};

/**
 * Scans ports using local TCP connect + banner grab or an external scanner worker.
 */
export const scanHostPorts = async ({ target, ports, type }) => {
    const normalizedPorts = normalizePortsInput(ports);
    const mode = getScanMode();
    if (mode === "local") {
        if (type === "UDP") {
            throw new Error("Local UDP scanning requires worker/cloud mode with LUMINET_SCANNER_WORKER_URL configured");
        }
        return { runnerProvider: "local_tcp_connect", asset: await scanWithLocalTcp({ target, ports: normalizedPorts }) };
    }
    if (mode === "worker" || mode === "cloud") {
        const result = await callScannerWorker("/scan-ports", { target, ports: normalizedPorts, type });
        assertPortScanWorkerResult(result);
        return {
            runnerProvider: mode,
            runnerJobId: result.runnerJobId,
            asset: result.asset
        };
    }
    throw new Error(`Unsupported LUMINET_SCAN_MODE: ${mode}. Supported values: local, worker, cloud`);
};

/**
 * Starts packet capture through the external sniffer worker.
 */
export const startPacketCapture = async ({ interfaceName, durationSec, filter }) => {
    const mode = getSniffingMode();
    if (mode === "worker" || mode === "cloud") {
        const result = await callSnifferWorker("/sniffing/start", { interfaceName, durationSec, filter });
        assertSnifferWorkerResult(result);
        return {
            runnerProvider: mode,
            runnerJobId: result.runnerJobId,
            status: result.status || "running",
            packets: result.packets || []
        };
    }
    throw new Error(
        "Local packet capture is not supported. Configure LUMINET_SNIFFING_MODE=worker|cloud and LUMINET_SNIFFER_WORKER_URL."
    );
};
