import { Router } from "express";
import { isAuthenticated } from "../../middleware/authentication.js";
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
    isValid(scanPortsValidation),
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

// Starts a packet sniffing session or mock session depending on environment mode.
networkRouter.post("/sniffing/start",
    canSniffTraffic,
    isValid(startSniffingValidation),
    asyncHandler(startSniffing)
);

// Returns recent packet samples until full WebSocket live streaming is connected.
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

export default networkRouter;
