/**
 * Parses port strings such as "22,80,443" or "1-1024".
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
 * Normalizes NetworkScanRequest.ports to a unique sorted number array.
 * Accepts number[], comma/range strings, or a single port number.
 */
export const normalizePortsInput = (ports) => {
    if (Array.isArray(ports)) {
        const normalized = [...new Set(
            ports
                .map((port) => Number(port))
                .filter((port) => Number.isInteger(port) && port >= 1 && port <= 65535)
        )].sort((a, b) => a - b);

        if (!normalized.length) {
            throw new Error("ports must contain at least one valid port between 1 and 65535");
        }

        return normalized;
    }

    if (typeof ports === "string") {
        const normalized = parsePortRange(ports);
        if (!normalized.length) {
            throw new Error("ports must contain at least one valid port between 1 and 65535");
        }
        return normalized;
    }

    if (typeof ports === "number" && Number.isInteger(ports) && ports >= 1 && ports <= 65535) {
        return [ports];
    }

    throw new Error("Invalid ports format; expected number[] or comma/range string");
};

/**
 * Formats a port number array for scanner workers that expect string ranges.
 */
export const formatPortsForRunner = (ports = []) => ports.join(",");
