import {
    NetworkAsset,
    NetworkFlowMetric,
    NetworkMisconfiguration,
    NetworkScan,
    SniffingSession
} from "../../../database/index.js";
import { AppError } from "../../utils/appError.js";
import { successResponse, paginatedResponse } from "../../utils/apiResponse.js";
import { networkAssetStatus, networkScanStatus, networkScanType, sniffingSessionStatus } from "../../utils/constant/enums.js";
import { emitAlert } from "../../utils/socket.js";
import { buildFlowMetric } from "../../utils/helpers/networkSimulator.js";
import { discoverHosts, scanHostPorts, startPacketCapture } from "../../utils/helpers/networkRunner.js";
import * as networkIntegration from "./services/integration.service.js";

/**
 * Upserts one network asset so repeated scans update inventory instead of duplicating hosts.
 */
const upsertAsset = async (assetData) => {
    return NetworkAsset.findOneAndUpdate(
        { mac: assetData.mac },
        {
            $set: {
                ...assetData,
                status: assetData.status || networkAssetStatus.ACTIVE,
                lastSeenAt: new Date()
            },
            $setOnInsert: {
                firstSeenAt: new Date()
            }
        },
        { new: true, upsert: true }
    );
};

/**
 * Creates misconfiguration records from risky open services.
 */
const createMisconfigurationsForAsset = async (asset) => {
    const riskyPorts = [
        {
            port: 23,
            type: "telnet_enabled",
            title: "Telnet service detected",
            description: "Telnet exposes plaintext remote administration and should be disabled.",
            severity: "high",
            recommendation: "Disable Telnet and use SSH with strong authentication."
        },
        {
            port: 445,
            type: "smb_exposed",
            title: "SMB service exposed",
            description: "SMB exposure can increase lateral movement risk if not segmented.",
            severity: "medium",
            recommendation: "Restrict SMB to trusted management networks."
        }
    ];

    const created = [];
    for (const risky of riskyPorts) {
        const matchingPort = asset.openPorts?.find((item) => item.port === risky.port);
        if (!matchingPort) continue;

        const misconfiguration = await NetworkMisconfiguration.findOneAndUpdate(
            { asset: asset._id, type: risky.type, status: "open" },
            {
                $set: {
                    assetIp: asset.ip,
                    assetMac: asset.mac,
                    evidence: matchingPort,
                    detectedAt: new Date()
                },
                $setOnInsert: {
                    asset: asset._id,
                    type: risky.type,
                    title: risky.title,
                    description: risky.description,
                    severity: risky.severity,
                    recommendation: risky.recommendation
                }
            },
            { new: true, upsert: true }
        );

        created.push(misconfiguration);
    }

    return created;
};

/**
 * Runs discovery through the configured LumiNet provider and persists discovered assets.
 */
export const discoverNetwork = async (req, res, next) => {
    const { subnet } = req.body;
    const startedAt = Date.now();

    const scan = await NetworkScan.create({
        type: networkScanType.DISCOVERY,
        status: networkScanStatus.RUNNING,
        target: subnet,
        requestedBy: req.authUser._id,
        startedAt: new Date(),
        runnerProvider: process.env.LUMINET_SCAN_MODE || "mock"
    });

    let discoveryResult;
    const assets = [];
    try {
        // INFRA/CLOUD INTEGRATION: worker/cloud mode calls the external ARP/ICMP/Nmap scanner service.
        discoveryResult = await discoverHosts({ subnet });
        for (const host of discoveryResult.assets) {
            assets.push(await upsertAsset(host));
        }
    } catch (error) {
        scan.status = networkScanStatus.FAILED;
        scan.completedAt = new Date();
        scan.durationMs = Date.now() - startedAt;
        scan.error = error.message;
        await scan.save();
        return next(error);
    }

    scan.status = networkScanStatus.COMPLETED;
    scan.completedAt = new Date();
    scan.durationMs = Date.now() - startedAt;
    scan.discoveredAssets = assets.map((asset) => asset._id);
    scan.runnerProvider = discoveryResult.runnerProvider;
    scan.runnerJobId = discoveryResult.runnerJobId;
    scan.resultSummary = {
        discoveredCount: assets.length,
        subnet
    };
    await scan.save();

    return successResponse(res, {
        message: "Network discovery completed",
        statusCode: 201,
        data: {
            task_id: scan._id,
            runner_provider: scan.runnerProvider,
            status: scan.status,
            discovered_count: assets.length,
            assets
        }
    });
};

/**
 * Runs port scanning through the configured LumiNet provider and updates service inventory.
 */
export const scanPorts = async (req, res, next) => {
    const { target, ports, type = "CONNECT" } = req.body;
    const startedAt = Date.now();

    const scan = await NetworkScan.create({
        type: networkScanType.PORT_SCAN,
        status: networkScanStatus.RUNNING,
        target,
        ports,
        scanMode: type,
        requestedBy: req.authUser._id,
        startedAt: new Date(),
        runnerProvider: process.env.LUMINET_SCAN_MODE || "mock"
    });

    let scanResult;
    let asset;
    let misconfigurations = [];
    try {
        // INFRA/CLOUD INTEGRATION: worker/cloud mode calls the isolated Nmap/python-nmap scanner service.
        scanResult = await scanHostPorts({ target, ports, type });
        asset = await upsertAsset(scanResult.asset);
        misconfigurations = await createMisconfigurationsForAsset(asset);
    } catch (error) {
        scan.status = networkScanStatus.FAILED;
        scan.completedAt = new Date();
        scan.durationMs = Date.now() - startedAt;
        scan.error = error.message;
        await scan.save();
        return next(error);
    }

    scan.status = networkScanStatus.COMPLETED;
    scan.completedAt = new Date();
    scan.durationMs = Date.now() - startedAt;
    scan.discoveredAssets = [asset._id];
    scan.runnerProvider = scanResult.runnerProvider;
    scan.runnerJobId = scanResult.runnerJobId;
    scan.resultSummary = {
        target,
        scanMode: type,
        openPorts: scanResult.asset.openPorts,
        misconfigurationCount: misconfigurations.length
    };
    await scan.save();

    return successResponse(res, {
        message: "Port scan completed",
        statusCode: 201,
        data: {
            task_id: scan._id,
            runner_provider: scan.runnerProvider,
            status: scan.status,
            asset,
            open_ports: scanResult.asset.openPorts,
            misconfigurations
        }
    });
};

/**
 * Lists network assets discovered by LumiNet.
 */
export const getAssetInventory = async (req, res, next) => {
    const { page = 1, limit = 20, os_type, status, search } = req.query;
    const skip = (Number(page) - 1) * Number(limit);
    const filter = {};

    if (os_type) filter.osType = os_type;
    if (status) filter.status = status;
    if (search) filter.$text = { $search: search };

    const [assets, total] = await Promise.all([
        NetworkAsset.find(filter).sort({ lastSeenAt: -1 }).skip(skip).limit(Number(limit)),
        NetworkAsset.countDocuments(filter)
    ]);

    return paginatedResponse(res, {
        message: "Asset inventory fetched",
        data: assets,
        page: Number(page),
        limit: Number(limit),
        total
    });
};

/**
 * Fetches one asset by MAC address with its related open misconfigurations.
 */
export const getAssetDetails = async (req, res, next) => {
    const mac = decodeURIComponent(req.params.mac).toUpperCase();
    const asset = await NetworkAsset.findOne({ mac });
    if (!asset) return next(new AppError("Network asset not found", 404));

    const misconfigurations = await NetworkMisconfiguration.find({ asset: asset._id, status: "open" }).sort({ detectedAt: -1 });

    return successResponse(res, {
        message: "Asset details fetched",
        data: {
            asset,
            misconfigurations
        }
    });
};

/**
 * Fetches asset context by IP for SOC, UCTC, SOAR, and GRC cross-tool lookups.
 */
export const getAssetContext = async (req, res, next) => {
    const { ip } = req.params;
    const asset = await NetworkAsset.findOne({ ip });
    if (!asset) return next(new AppError("Network asset not found", 404));

    const [misconfigurations, recentFlows] = await Promise.all([
        NetworkMisconfiguration.find({ asset: asset._id }).sort({ detectedAt: -1 }).limit(5),
        NetworkFlowMetric.find({ sourceIp: ip }).sort({ observedAt: -1 }).limit(5)
    ]);

    return successResponse(res, {
        message: "Asset context fetched",
        data: {
            asset,
            misconfigurations,
            recentFlows
        }
    });
};

/**
 * Starts packet capture through the configured LumiNet provider and stores sample packet data.
 */
export const startSniffing = async (req, res, next) => {
    const { interface: interfaceName, duration_sec = 300, filter = "ip" } = req.body;

    let captureResult;
    let packets = [];
    try {
        // INFRA/CLOUD INTEGRATION: worker/cloud mode calls the external Scapy/libpcap packet-capture service.
        captureResult = await startPacketCapture({ interfaceName, durationSec: duration_sec, filter });
        packets = captureResult.packets;
    } catch (error) {
        const failedSession = await SniffingSession.create({
            interfaceName,
            durationSec: duration_sec,
            filter,
            status: sniffingSessionStatus.FAILED,
            requestedBy: req.authUser._id,
            startedAt: new Date(),
            completedAt: new Date(),
            runnerProvider: process.env.LUMINET_SNIFFING_MODE || "mock",
            error: error.message
        });
        error.sessionId = failedSession._id;
        return next(error);
    }

    const packetCount = packets.length;
    const byteCount = packets.reduce((total, packet) => total + packet.size, 0);

    const session = await SniffingSession.create({
        interfaceName,
        durationSec: duration_sec,
        filter,
        status: captureResult.status === "running" ? sniffingSessionStatus.RUNNING : sniffingSessionStatus.COMPLETED,
        requestedBy: req.authUser._id,
        startedAt: new Date(),
        completedAt: captureResult.status === "running" ? undefined : new Date(),
        packetCount,
        byteCount,
        samplePackets: packets,
        runnerProvider: captureResult.runnerProvider,
        runnerJobId: captureResult.runnerJobId
    });

    // INFRA/CLOUD INTEGRATION: Real live traffic should be emitted continuously to this Socket.IO room.
    emitAlert(`user:${req.authUser._id}`, "network:sniffing:sample", {
        session_id: session._id,
        packets
    });

    return successResponse(res, {
        message: "Sniffing session started",
        statusCode: 201,
        data: {
            session_id: session._id,
            runner_provider: session.runnerProvider,
            status: session.status,
            packet_count: packetCount,
            byte_count: byteCount,
            sample_packets: packets
        }
    });
};

/**
 * Returns the latest packet samples for HTTP clients until real WebSocket streaming is connected.
 */
export const getLiveStreamSamples = async (req, res, next) => {
    const { session_id, limit = 20 } = req.query;
    const filter = {};
    if (session_id) filter._id = session_id;

    const sessions = await SniffingSession.find(filter).sort({ createdAt: -1 }).limit(Number(limit));
    const packets = sessions.flatMap((session) => session.samplePackets.map((packet) => ({
        session_id: session._id,
        ...packet
    })));

    return successResponse(res, {
        message: "Live stream samples fetched",
        data: {
            websocket_event: "network:sniffing:sample",
            packets
        }
    });
};

/**
 * Lists detected network misconfigurations for analyst review and GRC handoff.
 */
export const getMisconfigurations = async (req, res, next) => {
    const { page = 1, limit = 20, severity, status, asset_ip } = req.query;
    const skip = (Number(page) - 1) * Number(limit);
    const filter = {};

    if (severity) filter.severity = severity;
    if (status) filter.status = status;
    if (asset_ip) filter.assetIp = asset_ip;

    const [misconfigurations, total] = await Promise.all([
        NetworkMisconfiguration.find(filter).sort({ detectedAt: -1 }).skip(skip).limit(Number(limit)).populate("asset"),
        NetworkMisconfiguration.countDocuments(filter)
    ]);

    return paginatedResponse(res, {
        message: "Network misconfigurations fetched",
        data: misconfigurations,
        page: Number(page),
        limit: Number(limit),
        total
    });
};

/**
 * Returns network flow metrics and creates a mock baseline metric when no data exists yet.
 */
export const getFlowMetrics = async (req, res, next) => {
    const { page = 1, limit = 20, source_ip, anomaly_only } = req.query;
    const skip = (Number(page) - 1) * Number(limit);
    const filter = {};

    if (source_ip) filter.sourceIp = source_ip;
    if (anomaly_only !== undefined) filter.isAnomaly = anomaly_only === true || anomaly_only === "true";

    if (await NetworkFlowMetric.countDocuments() === 0) {
        // INFRA/CLOUD INTEGRATION: Replace seeded mock metrics with live NetFlow/packet capture aggregation.
        await NetworkFlowMetric.create([
            buildFlowMetric({ sourceIp: "10.0.0.5", destinationIp: "10.0.0.20", packetsPerSecond: 220, bandwidthKbps: 4096 }),
            buildFlowMetric({ sourceIp: "10.0.0.8", destinationIp: "8.8.8.8", protocol: "UDP", packetsPerSecond: 45, bandwidthKbps: 512 })
        ]);
    }

    const [metrics, total] = await Promise.all([
        NetworkFlowMetric.find(filter).sort({ observedAt: -1 }).skip(skip).limit(Number(limit)),
        NetworkFlowMetric.countDocuments(filter)
    ]);

    const anomalies = metrics.filter((metric) => metric.isAnomaly);
    for (const anomaly of anomalies) {
        // INFRA/CLOUD INTEGRATION: Push overflow anomalies to SIEM and trigger SOAR playbooks when credentials are ready.
        emitAlert("soc_analyst", "network:flow:anomaly", anomaly);
    }

    return paginatedResponse(res, {
        message: "Network flow metrics fetched",
        data: metrics,
        page: Number(page),
        limit: Number(limit),
        total
    });
};

export const integrateGrcFinding = async (req, res) => {
    const finding = await networkIntegration.pushGrcFinding(req.body, req.authUser);
    return successResponse(res, { message: "GRC finding created from network integration", data: finding, statusCode: 201 });
};

export const integrateSoarIncident = async (req, res) => {
    const incident = await networkIntegration.pushSoarIncident(req.body, req.authUser);
    return successResponse(res, { message: "SOAR incident created from network integration", data: incident, statusCode: 201 });
};

export const integrateUctcDetectionGap = async (req, res) => {
    const result = await networkIntegration.pushUctcDetectionGap(req.body, req.authUser);
    return successResponse(res, { message: "UCTC detection gap forwarded", data: result, statusCode: 201 });
};

export const integrateSiemEvent = async (req, res) => {
    const result = await networkIntegration.pushSiemEvent(req.body);
    return successResponse(res, { message: "Network event forwarded to SIEM", data: result, statusCode: 202 });
};

export const integrateOpenCtiEnrichment = async (req, res) => {
    const result = await networkIntegration.pushOpenCtiEnrichment(req.body);
    return successResponse(res, { message: "OpenCTI enrichment completed", data: result });
};
