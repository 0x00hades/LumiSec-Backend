import { Router } from "express";
import { isValid } from "../../middleware/validation.js";
import { asyncHandler } from "../../middleware/asyncHandler.js";
import { isAuthenticated } from "../../middleware/authentication.js";
import { isAuthorized } from "../../middleware/authorization.js";
import { roles } from "../../utils/constant/enums.js";
import { createIncidentValidation, createPlaybookValidation } from "./soar.validation.js";
import { createIncident, executePlaybook, closeIncident, getIncidents } from "./soar.controller.js";

const soarRouter = Router();

soarRouter.post("/incidents",
    isAuthenticated(),
    isAuthorized([roles.ADMIN, roles.SOC_ANALYST, roles.SOC_MANAGER]),
    isValid(createIncidentValidation),
    asyncHandler(createIncident)
);

soarRouter.get("/incidents",
    isAuthenticated(),
    isAuthorized([roles.ADMIN, roles.SOC_ANALYST, roles.SOC_MANAGER]),
    asyncHandler(getIncidents)
);

soarRouter.post("/incidents/:incidentId/playbook/:playbookId",
    isAuthenticated(),
    isAuthorized([roles.ADMIN, roles.SOC_ANALYST]),
    asyncHandler(executePlaybook)
);

soarRouter.patch("/incidents/:incidentId/close",
    isAuthenticated(),
    isAuthorized([roles.ADMIN, roles.SOC_ANALYST, roles.SOC_MANAGER]),
    asyncHandler(closeIncident)
);

export default soarRouter;
