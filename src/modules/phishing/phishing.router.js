import { Router } from "express";
import { isValid } from "../../middleware/validation.js";
import { asyncHandler } from "../../middleware/asyncHandler.js";
import { isAuthenticated } from "../../middleware/authentication.js";
import { isAuthorized } from "../../middleware/authorization.js";
import { roles } from "../../utils/constant/enums.js";
import { createCampaignValidation, trackEventValidation } from "./phishing.validation.js";
import { createCampaign, launchCampaign, trackEvent, getCampaigns } from "./phishing.controller.js";

const phishingRouter = Router();

phishingRouter.post("/",
    isAuthenticated(),
    isAuthorized([roles.ADMIN, roles.SOC_MANAGER]),
    isValid(createCampaignValidation),
    asyncHandler(createCampaign)
);

phishingRouter.post("/:campaignId/launch",
    isAuthenticated(),
    isAuthorized([roles.ADMIN, roles.SOC_MANAGER]),
    asyncHandler(launchCampaign)
);

phishingRouter.get("/",
    isAuthenticated(),
    isAuthorized([roles.ADMIN, roles.SOC_MANAGER, roles.SOC_ANALYST]),
    asyncHandler(getCampaigns)
);

// Public tracking endpoint (no auth — hit by victims' browsers)
phishingRouter.post("/track/:trackingId",
    isValid(trackEventValidation),
    asyncHandler(trackEvent)
);

export default phishingRouter;
