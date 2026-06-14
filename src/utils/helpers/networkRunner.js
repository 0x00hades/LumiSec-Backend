import net from "net";
import os from "os";
import { spawn } from "child_process";
import axios from "axios";
import {
    generateMockDiscovery,
    generateMockPackets,
    generateMockPortScan,
    parsePortRange
} from "./networkSimulator.js";

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

/**
 * Returns the configured LumiNet scan provider.
 */
const getScanMode = () => process.env.LUMINET_SCAN_MODE || "mock";

/**
 * Returns the configured LumiNet packet-capture provider.
 */
const getSniffingMode = () => process.env.LUMINET_SNIFFING_MODE || "mock";

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
 * Maps one live IP into the asset shape used by the database model.
 */
const buildDiscoveredAsset = async (ip, subnet) => {
    const mac = await resolveMacFromArp(ip);
    return {
        ip,
        mac: mac || fallbackMacFromIp(ip),
        hostname: `host-${ip.replace(/\./g, "-")}`,
        osType: "unknown",
        vendor: mac ? "unknown" : "unresolved",
        status: "active",
        metadata: {
            discoveryMethod: "local_ping",
            sourceSubnet: subnet,
            macSource: mac ? "arp" : "fallback"
        }
    };
};

/**
 * Runs local ping discovery for a CIDR range.
 */
const discoverWithLocalPing = async (subnet) => {
    const hosts = enumerateCidrHosts(subnet);
    const concurrency = Number(process.env.LUMINET_SCAN_CONCURRENCY) || 32;
    const discovered = [];

    for (let index = 0; index < hosts.length; index += concurrency) {
        const batch = hosts.slice(index, index + concurrency);
        const results = await Promise.all(batch.map(async (ip) => ({
            ip,
            alive: await pingHost(ip)
        })));

        for (const result of results) {
            if (result.alive) discovered.push(await buildDiscoveredAsset(result.ip, subnet));
        }
    }

    return discovered;
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
 * Runs a local TCP connect scan and returns the common asset result shape.
 */
const scanWithLocalTcp = async ({ target, ports }) => {
    const requestedPorts = parsePortRange(ports);
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
            openPorts.push({
                port: result.port,
                protocol: "tcp",
                service: serviceByPort[result.port] || "unknown",
                banner: "",
                state: "open",
                detectedAt: new Date()
            });
        }
    }

    const mac = await resolveMacFromArp(target);
    return {
        ip: target,
        mac: mac || fallbackMacFromIp(target),
        hostname: `asset-${target.replace(/\./g, "-")}`,
        osType: "unknown",
        vendor: mac ? "unknown" : "unresolved",
        status: "active",
        openPorts,
        metadata: {
            scanMethod: "local_tcp_connect",
            macSource: mac ? "arp" : "fallback"
        }
    };
};

/**
 * Calls the future scanner worker service used by cloud/infrastructure integration.
 */
const callScannerWorker = async (path, payload) => {
    const baseUrl = process.env.LUMINET_SCANNER_WORKER_URL;
    if (!baseUrl) throw new Error("LUMINET_SCANNER_WORKER_URL is not configured");
    const { data } = await axios.post(`${baseUrl}${path}`, payload, {
        timeout: Number(process.env.LUMINET_SCAN_TIMEOUT_SEC || 60) * 1000
    });
    return data;
};

/**
 * Calls the future sniffer worker service used by cloud/infrastructure integration.
 */
const callSnifferWorker = async (path, payload) => {
    const baseUrl = process.env.LUMINET_SNIFFER_WORKER_URL;
    if (!baseUrl) throw new Error("LUMINET_SNIFFER_WORKER_URL is not configured");
    const { data } = await axios.post(`${baseUrl}${path}`, payload, {
        timeout: Number(process.env.LUMINET_SCAN_TIMEOUT_SEC || 60) * 1000
    });
    return data;
};

/**
 * Fails fast when an external scanner worker returns an unexpected discovery payload.
 */
const assertDiscoveryWorkerResult = (result) => {
    if (!Array.isArray(result?.assets)) {
        throw new Error("Scanner worker returned an invalid discovery response: assets array is required");
    }
};

/**
 * Fails fast when an external scanner worker returns an unexpected port-scan payload.
 */
const assertPortScanWorkerResult = (result) => {
    if (!result?.asset?.ip || !result.asset.mac) {
        throw new Error("Scanner worker returned an invalid port-scan response: asset ip and mac are required");
    }
    if (!Array.isArray(result.asset.openPorts)) {
        result.asset.openPorts = [];
    }
};

/**
 * Fails fast when an external sniffer worker returns an unexpected packet-capture payload.
 */
const assertSnifferWorkerResult = (result) => {
    if (result?.packets !== undefined && !Array.isArray(result.packets)) {
        throw new Error("Sniffer worker returned an invalid response: packets must be an array");
    }
};

/**
 * Discovers hosts using mock, local ping, or external worker mode.
 */
export const discoverHosts = async ({ subnet }) => {
    const mode = getScanMode();
    if (mode === "mock") return { runnerProvider: "mock", assets: generateMockDiscovery(subnet) };
    if (mode === "local") return { runnerProvider: "local_ping", assets: await discoverWithLocalPing(subnet) };
    if (mode === "worker" || mode === "cloud") {
        const result = await callScannerWorker("/discover", { subnet });
        assertDiscoveryWorkerResult(result);
        return {
            runnerProvider: mode,
            runnerJobId: result.runnerJobId,
            assets: result.assets
        };
    }
    throw new Error(`Unsupported LUMINET_SCAN_MODE: ${mode}`);
};

/**
 * Scans ports using mock, local TCP connect, or external worker mode.
 */
export const scanHostPorts = async ({ target, ports, type }) => {
    const mode = getScanMode();
    if (mode === "mock") return { runnerProvider: "mock", asset: generateMockPortScan({ target, ports }) };
    if (mode === "local") {
        if (type === "UDP") throw new Error("Local UDP scanning requires the external scanner worker");
        return { runnerProvider: "local_tcp_connect", asset: await scanWithLocalTcp({ target, ports }) };
    }
    if (mode === "worker" || mode === "cloud") {
        const result = await callScannerWorker("/scan-ports", { target, ports, type });
        assertPortScanWorkerResult(result);
        return {
            runnerProvider: mode,
            runnerJobId: result.runnerJobId,
            asset: result.asset
        };
    }
    throw new Error(`Unsupported LUMINET_SCAN_MODE: ${mode}`);
};

/**
 * Starts packet capture using mock samples or the future external sniffer worker.
 */
export const startPacketCapture = async ({ interfaceName, durationSec, filter }) => {
    const mode = getSniffingMode();
    if (mode === "mock") {
        return {
            runnerProvider: "mock",
            status: "completed",
            packets: generateMockPackets({ interfaceName, filter })
        };
    }
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
    throw new Error("Local packet sniffing requires the external Scapy/libpcap sniffer worker");
};
