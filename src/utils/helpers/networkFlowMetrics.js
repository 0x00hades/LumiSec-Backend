/**
 * Computes flow anomaly metrics from observed packet rate and bandwidth.
 */
export const buildFlowMetric = ({
    sourceIp,
    destinationIp,
    protocol = "TCP",
    packetsPerSecond,
    bandwidthKbps,
    baselinePacketsPerSecond = 100
}) => {
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

/**
 * Aggregates captured packet samples into flow metrics.
 */
export const aggregatePacketsToFlowMetrics = (packets = [], durationSec = 1) => {
    if (!packets.length) return [];

    const windowSec = Math.max(1, durationSec);
    const flows = new Map();

    for (const packet of packets) {
        const sourceIp = packet.src_ip || packet.sourceIp;
        const destinationIp = packet.dst_ip || packet.destinationIp;
        const protocol = packet.protocol || "TCP";
        if (!sourceIp || !destinationIp) continue;

        const key = `${sourceIp}|${destinationIp}|${protocol}`;
        const current = flows.get(key) || { sourceIp, destinationIp, protocol, packetCount: 0, byteCount: 0 };
        current.packetCount += 1;
        current.byteCount += Number(packet.size || 0);
        flows.set(key, current);
    }

    return [...flows.values()].map((flow) => buildFlowMetric({
        sourceIp: flow.sourceIp,
        destinationIp: flow.destinationIp,
        protocol: flow.protocol,
        packetsPerSecond: Number((flow.packetCount / windowSec).toFixed(2)),
        bandwidthKbps: Number(((flow.byteCount * 8) / windowSec / 1000).toFixed(2))
    }));
};
