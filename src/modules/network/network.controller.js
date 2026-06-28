import {
    NetworkAsset,
    NetworkFlowMetric,
    NetworkMisconfiguration,
    NetworkScan,
    SniffingSession
} from "../../../database/index.js";
import { AppError } from "../../utils/appError.js";
import { successResponse, paginatedResponse } from "../../utils/apiResponse.js";
import { networkScanStatus, networkScanType, sniffingSessionStatus } from "../../utils/constant/enums.js";
import { emitAlert } from "../../utils/socket.js";
import { aggregatePacketsToFlowMetrics } from "../../utils/helpers/networkFlowMetrics.js";
import {
    discoverHosts,
    getConfiguredScanMode,
    getConfiguredSniffingMode,
    scanHostPorts,
    startPacketCapture
} from "../../utils/helpers/networkRunner.js";
import * as networkIntegration from "./services/integration.service.js";
import {
    refreshSniffingSessionSamples,
    buildLiveStreamStats
} from "../../utils/helpers/networkSniffingLive.js";
import { upsertNetworkAsset } from "./services/networkAsset.service.js";

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

const pushAutoIntegrationsForMisconfigurations = async (misconfigurations, scan, user) => {
    for (const misconfiguration of misconfigurations) {
        try {
            await networkIntegration.autoIntegrateOnCriticalFinding({
                finding: {
                    title: misconfiguration.title,
                    description: misconfiguration.description,
                    severity: misconfiguration.severity,
                    asset: misconfiguration.assetIp,
                    findingType: misconfiguration.type
                },
                scan,
                user
            });
        } catch {
            // Scan results remain successful even if downstream integrations fail.
        }
    }
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
        runnerProvider: getConfiguredScanMode()
    });

    let discoveryResult;
    const assets = [];
    try {
        // INFRA/CLOUD INTEGRATION: worker/cloud mode calls the external ARP/ICMP/Nmap scanner service.
        discoveryResult = await discoverHosts({ subnet });
        for (const host of discoveryResult.assets) {
            assets.push(await upsertNetworkAsset(host));
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
    const { target, ports, scanMode = "CONNECT" } = req.body;
    const startedAt = Date.now();

    const scan = await NetworkScan.create({
        type: networkScanType.PORT_SCAN,
        status: networkScanStatus.RUNNING,
        target,
        ports,
        scanMode,
        requestedBy: req.authUser._id,
        startedAt: new Date(),
        runnerProvider: getConfiguredScanMode()
    });

    let scanResult;
    let asset;
    let misconfigurations = [];
    try {
        scanResult = await scanHostPorts({ target, ports, type: scanMode });
        asset = await upsertNetworkAsset(scanResult.asset);
        misconfigurations = await createMisconfigurationsForAsset(asset);
        await pushAutoIntegrationsForMisconfigurations(misconfigurations, scan, req.authUser);
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
        scanMode,
        ports,
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
            target,
            ports,
            scanMode,
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
            runnerProvider: getConfiguredSniffingMode(),
            error: error.message
        });
        error.sessionId = failedSession._id;
        return next(error);
    }

    const packetCount = packets.length;
    const byteCount = packets.reduce((total, packet) => total + Number(packet.size || 0), 0);
    const keepLive = duration_sec > 0;

    const session = await SniffingSession.create({
        interfaceName,
        durationSec: duration_sec,
        filter,
        status: keepLive ? sniffingSessionStatus.RUNNING : sniffingSessionStatus.COMPLETED,
        requestedBy: req.authUser._id,
        startedAt: new Date(),
        completedAt: keepLive ? undefined : new Date(),
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
            session_id: String(session._id),
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

    let sessions = await SniffingSession.find(filter).sort({ createdAt: -1 }).limit(Number(limit));

    sessions = await Promise.all(
        sessions.map((session) => (
            session.status === sniffingSessionStatus.RUNNING
                ? refreshSniffingSessionSamples(session)
                : session
        ))
    );

    const packets = sessions.flatMap((session) => session.samplePackets.map((packet) => ({
        session_id: session._id,
        ...packet
    })));

    const primarySession = sessions[0];
    const stats = buildLiveStreamStats(packets);

    return successResponse(res, {
        message: "Live stream samples fetched",
        data: {
            websocket_event: "network:sniffing:sample",
            session_id: primarySession?._id,
            status: primarySession?.status,
            duration_sec: primarySession?.durationSec,
            packets,
            stats
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
 * Updates misconfiguration status after analyst remediation.
 */
export const updateMisconfigurationStatus = async (req, res, next) => {
    const misconfiguration = await NetworkMisconfiguration.findByIdAndUpdate(
        req.params.id,
        { $set: { status: req.body.status } },
        { new: true, runValidators: true }
    );

    if (!misconfiguration) {
        return next(new AppError("Network misconfiguration not found", 404));
    }

    return successResponse(res, {
        message: "Misconfiguration status updated",
        data: misconfiguration
    });
};

/**
 * Returns network flow metrics aggregated from captured packet data.
 */
export const getFlowMetrics = async (req, res, next) => {
    const { page = 1, limit = 20, source_ip, anomaly_only } = req.query;
    const skip = (Number(page) - 1) * Number(limit);
    const filter = {};

    if (source_ip) filter.sourceIp = source_ip;
    if (anomaly_only !== undefined) filter.isAnomaly = anomaly_only === true || anomaly_only === "true";

    if (await NetworkFlowMetric.countDocuments() === 0) {
        const recentSessions = await SniffingSession.find({
            status: { $in: [sniffingSessionStatus.COMPLETED, sniffingSessionStatus.RUNNING] },
            packetCount: { $gt: 0 }
        })
            .sort({ createdAt: -1 })
            .limit(5);

        const derivedMetrics = recentSessions.flatMap((session) =>
            aggregatePacketsToFlowMetrics(session.samplePackets, session.durationSec)
        );

        if (derivedMetrics.length) {
            await NetworkFlowMetric.insertMany(derivedMetrics);
        }
    }

    const [metrics, total] = await Promise.all([
        NetworkFlowMetric.find(filter).sort({ observedAt: -1 }).skip(skip).limit(Number(limit)),
        NetworkFlowMetric.countDocuments(filter)
    ]);

    const anomalies = metrics.filter((metric) => metric.isAnomaly);
    for (const anomaly of anomalies) {
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
