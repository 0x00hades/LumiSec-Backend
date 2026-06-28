import { sniffingSessionStatus } from "../constant/enums.js";

const PROTOCOLS = ["TCP", "UDP", "DNS", "TLS", "ICMP"];
const PRIVATE_SOURCES = ["10.0.0.5", "192.168.1.42", "172.16.0.8"];
const PRIVATE_DESTS = ["10.0.0.20", "192.168.1.1", "8.8.8.8"];

export const buildSimulatedPacket = (session, index) => {
    const protocol = PROTOCOLS[index % PROTOCOLS.length];
    const srcIp = PRIVATE_SOURCES[index % PRIVATE_SOURCES.length];
    const dstIp = PRIVATE_DESTS[index % PRIVATE_DESTS.length];
    const srcPort = 40000 + index * 137;
    const dstPort = protocol === "DNS" ? 53 : protocol === "TLS" ? 443 : 80 + (index % 3);
    const suspicious = protocol === "TCP" && dstPort === 23;

    return {
        timestamp: new Date(),
        interface: session.interfaceName,
        filter: session.filter,
        src_ip: srcIp,
        dst_ip: dstIp,
        protocol,
        src_port: srcPort,
        dst_port: dstPort,
        size: 256 + index * 48,
        suspicious,
        summary: suspicious ? "Suspicious telnet traffic" : `${protocol} flow`
    };
};

/**
 * Grows sample packets for active sniffing sessions so HTTP polling can simulate a live capture.
 */
export const refreshSniffingSessionSamples = async (session) => {
    if (!session) return session;

    const maxSamples = Math.min(
        Math.max(Math.floor((session.durationSec || 30) / 2), 4),
        Number(process.env.LUMINET_MAX_PACKET_SAMPLES || 100)
    );
    const elapsedSec = (Date.now() - new Date(session.startedAt).getTime()) / 1000;
    const targetCount = Math.min(
        Math.max(Math.floor(elapsedSec / 2) + 1, session.samplePackets?.length || 0),
        maxSamples
    );

    if (!Array.isArray(session.samplePackets)) {
        session.samplePackets = [];
    }

    while (session.samplePackets.length < targetCount) {
        session.samplePackets.push(buildSimulatedPacket(session, session.samplePackets.length));
    }

    session.packetCount = session.samplePackets.length;
    session.byteCount = session.samplePackets.reduce((total, packet) => total + Number(packet.size || 0), 0);

    if (
        session.status === sniffingSessionStatus.RUNNING
        && elapsedSec >= (session.durationSec || 30)
    ) {
        session.status = sniffingSessionStatus.COMPLETED;
        session.completedAt = new Date();
    }

    if (session.isModified()) {
        await session.save();
    }

    return session;
};

export const buildLiveStreamStats = (packets = []) => {
    const protocolSet = new Set();
    let suspicious = 0;

    packets.forEach((packet) => {
        if (packet.protocol) protocolSet.add(String(packet.protocol).toUpperCase());
        if (packet.suspicious) suspicious += 1;
    });

    return {
        totalPackets: packets.length,
        protocols: protocolSet.size,
        suspicious,
        avgPps: packets.length > 0 ? Math.max(1, Math.round(packets.length / 5)) : 0
    };
};
