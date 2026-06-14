const vendorByOctet = ["Cisco", "Dell", "HP", "Ubiquiti", "VMware", "Microsoft"];
const osByOctet = ["linux", "windows", "network_device", "printer", "unknown"];
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
 * Extracts a stable IPv4 prefix from a CIDR subnet for mock discovery.
 */
const getSubnetPrefix = (subnet) => {
    const [baseIp] = subnet.split("/");
    const parts = baseIp.split(".");
    return parts.length === 4 ? parts.slice(0, 3).join(".") : "192.168.1";
};

/**
 * Builds a deterministic MAC address so repeated mock scans update the same assets.
 */
const buildMockMac = (hostNumber) => {
    const suffix = hostNumber.toString(16).padStart(2, "0").toUpperCase();
    return `00:1A:2B:3C:4D:${suffix}`;
};

/**
 * Produces safe mock host discovery results until ARP/ICMP/Nmap integration is connected.
 */
export const generateMockDiscovery = (subnet, count = 4) => {
    const prefix = getSubnetPrefix(subnet);
    return Array.from({ length: count }, (_, index) => {
        const hostNumber = 10 + index;
        return {
            ip: `${prefix}.${hostNumber}`,
            mac: buildMockMac(hostNumber),
            hostname: `luminet-${hostNumber}`,
            osType: osByOctet[hostNumber % osByOctet.length],
            vendor: vendorByOctet[hostNumber % vendorByOctet.length],
            status: "active",
            metadata: {
                discoveryMethod: "mock",
                sourceSubnet: subnet
            }
        };
    });
};

/**
 * Parses simple port strings such as "22,80,443" or "1-1024".
 */
export const parsePortRange = (ports = "1-1024") => {
    const selectedPorts = new Set();
    for (const part of String(ports).split(",")) {
        const trimmed = part.trim();
        if (!trimmed) continue;
        if (trimmed.includes("-")) {
            const [start, end] = trimmed.split("-").map(Number);
            if (!Number.isInteger(start) || !Number.isInteger(end)) continue;
            for (let port = Math.max(1, start); port <= Math.min(65535, end); port += 1) {
                selectedPorts.add(port);
            }
        } else {
            const port = Number(trimmed);
            if (Number.isInteger(port) && port >= 1 && port <= 65535) selectedPorts.add(port);
        }
    }
    return [...selectedPorts].sort((a, b) => a - b);
};

/**
 * Generates deterministic mock open ports from a requested port range.
 */
export const generateMockPortScan = ({ target, ports }) => {
    const requestedPorts = parsePortRange(ports);
    const commonOpenPorts = [22, 80, 443, 445, 3389, 5985].filter((port) => requestedPorts.includes(port));
    const fallbackPorts = requestedPorts.slice(0, 3);
    const openPorts = (commonOpenPorts.length ? commonOpenPorts : fallbackPorts).map((port) => ({
        port,
        protocol: "tcp",
        service: serviceByPort[port] || "unknown",
        banner: `${serviceByPort[port] || "service"} mock banner on ${target}:${port}`,
        state: "open",
        detectedAt: new Date()
    }));

    return {
        ip: target,
        mac: buildMockMac(target.split(".").map(Number).pop() || 50),
        hostname: `asset-${target.replace(/\./g, "-")}`,
        osType: target.endsWith(".50") ? "windows" : "linux",
        vendor: "MockVendor",
        status: "active",
        openPorts,
        metadata: {
            scanMethod: "mock"
        }
    };
};

/**
 * Creates safe packet samples that represent the JSON stream expected from packet decoders.
 */
export const generateMockPackets = ({ interfaceName, filter }) => {
    const now = new Date();
    return [
        {
            timestamp: now,
            interface: interfaceName,
            filter,
            src_ip: "10.0.0.5",
            dst_ip: "10.0.0.20",
            protocol: "TCP",
            src_port: 51514,
            dst_port: 80,
            flags: "PA",
            size: 512
        },
        {
            timestamp: now,
            interface: interfaceName,
            filter,
            src_ip: "10.0.0.8",
            dst_ip: "8.8.8.8",
            protocol: "UDP",
            src_port: 5353,
            dst_port: 53,
            size: 128
        }
    ];
};

/**
 * Computes a simple overflow/anomaly record from packet volume and baseline values.
 */
export const buildFlowMetric = ({ sourceIp, destinationIp, protocol = "TCP", packetsPerSecond, bandwidthKbps }) => {
    const baselinePacketsPerSecond = 100;
    const thresholdPacketsPerSecond = baselinePacketsPerSecond + (3 * 25);
    const isAnomaly = packetsPerSecond > thresholdPacketsPerSecond;

    return {
        sourceIp,
        destinationIp,
        protocol,
        packetsPerSecond,
        bandwidthKbps,
        baselinePacketsPerSecond,
        thresholdPacketsPerSecond,
        isAnomaly,
        severity: isAnomaly ? "high" : "low",
        observedAt: new Date()
    };
};
