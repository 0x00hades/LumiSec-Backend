import { Router } from "express";
import { isAuthenticated } from "../../middleware/authentication.js";
import { isServiceOrUserAuthenticated } from "../../middleware/serviceAuth.js";
import { isAuthorized } from "../../middleware/authorization.js";
import { asyncHandler } from "../../middleware/asyncHandler.js";
import { isValid } from "../../middleware/validation.js";
import { roles } from "../../utils/constant/enums.js";
import {
    assetContextValidation,
    assetDetailsValidation,
    discoverNetworkValidation,
    flowMetricsValidation,
    listAssetsValidation,
    listMisconfigurationsValidation,
    liveStreamValidation,
    networkGrcFindingValidation,
    networkOpenCtiValidation,
    networkSiemEventValidation,
    networkSoarIncidentValidation,
    networkUctcGapValidation,
    scanPortsValidation,
    startSniffingValidation
} from "./network.validation.js";
import {
    discoverNetwork,
    getAssetContext,
    getAssetDetails,
    getAssetInventory,
    getFlowMetrics,
    getLiveStreamSamples,
    getMisconfigurations,
    integrateGrcFinding,
    integrateOpenCtiEnrichment,
    integrateSiemEvent,
    integrateSoarIncident,
    integrateUctcDetectionGap,
    scanPorts,
    startSniffing
} from "./network.controller.js";

const networkRouter = Router();

networkRouter.use(isAuthenticated());

const canReadNetwork = isAuthorized([roles.ADMIN, roles.SOC_ANALYST, roles.SOC_MANAGER, roles.DETECTION_ENGINEER, roles.IT_MANAGER, roles.GRC_MANAGER]);
const canRunNetwork = isAuthorized([roles.ADMIN, roles.DETECTION_ENGINEER, roles.IT_MANAGER]);
const canSniffTraffic = isAuthorized([roles.ADMIN, roles.DETECTION_ENGINEER, roles.SOC_ANALYST]);

// Starts network discovery for a CIDR subnet and updates asset inventory.
networkRouter.post("/network/discover",
    canRunNetwork,
    isValid(discoverNetworkValidation),
    asyncHandler(discoverNetwork)
);

// Starts a port/service scan for a target host and stores detected services.
networkRouter.post("/network/scan-ports",
    canRunNetwork,
    isValid(scanPortsValidation, "body"),
    asyncHandler(scanPorts)
);

// Lists discovered assets with filters for dashboard and inventory screens.
networkRouter.get("/assets/inventory",
    canReadNetwork,
    isValid(listAssetsValidation),
    asyncHandler(getAssetInventory)
);

// Fetches one asset by MAC address with related risk/misconfiguration context.
networkRouter.get("/assets/details/:mac",
    canReadNetwork,
    isValid(assetDetailsValidation),
    asyncHandler(getAssetDetails)
);

// Provides asset context by IP for SOC, SOAR, UCTC, and GRC integrations.
networkRouter.get("/assets/context/:ip",
    canReadNetwork,
    isValid(assetContextValidation),
    asyncHandler(getAssetContext)
);

// Starts a packet sniffing session through the configured sniffer worker.
networkRouter.post("/sniffing/start",
    canSniffTraffic,
    isValid(startSniffingValidation),
    asyncHandler(startSniffing)
);

// Returns recent packet samples captured by active or completed sniffing sessions.
networkRouter.get("/sniffing/live-stream",
    canSniffTraffic,
    isValid(liveStreamValidation),
    asyncHandler(getLiveStreamSamples)
);

// Lists detected weak services and network misconfigurations.
networkRouter.get("/network/misconfigurations",
    canReadNetwork,
    isValid(listMisconfigurationsValidation),
    asyncHandler(getMisconfigurations)
);

// Returns flow metrics and traffic overflow/anomaly indicators.
networkRouter.get("/network/flow-metrics",
    canReadNetwork,
    isValid(flowMetricsValidation),
    asyncHandler(getFlowMetrics)
);

const canIntegrate = isAuthorized([roles.ADMIN, roles.SOC_MANAGER, roles.DETECTION_ENGINEER, roles.IT_MANAGER, roles.INTEGRATION_ADMIN]);

// ─── Integrations ────────────────────────────────────────────────────────────
networkRouter.post("/integrations/grc/finding",
    isServiceOrUserAuthenticated(), canIntegrate, isValid(networkGrcFindingValidation),
    asyncHandler(integrateGrcFinding)
);
networkRouter.post("/integrations/soar/incident",
    isServiceOrUserAuthenticated(), canIntegrate, isValid(networkSoarIncidentValidation),
    asyncHandler(integrateSoarIncident)
);
networkRouter.post("/integrations/uctc/detection-gap",
    isServiceOrUserAuthenticated(), canIntegrate, isValid(networkUctcGapValidation),
    asyncHandler(integrateUctcDetectionGap)
);
networkRouter.post("/integrations/siem/event",
    isServiceOrUserAuthenticated(), canIntegrate, isValid(networkSiemEventValidation),
    asyncHandler(integrateSiemEvent)
);
networkRouter.post("/integrations/opencti/enrichment",
    isServiceOrUserAuthenticated(), canIntegrate, isValid(networkOpenCtiValidation),
    asyncHandler(integrateOpenCtiEnrichment)
);

export default networkRouter;
