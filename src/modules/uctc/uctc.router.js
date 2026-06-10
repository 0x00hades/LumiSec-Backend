import { Router } from "express";
import { isValid } from "../../middleware/validation.js";
import { asyncHandler } from "../../middleware/asyncHandler.js";
import { isAuthenticated } from "../../middleware/authentication.js";
import { isAuthorized } from "../../middleware/authorization.js";
import { roles } from "../../utils/constant/enums.js";
import { createRuleValidation } from "./uctc.validation.js";
import { createRule, deployRule, getRules } from "./uctc.controller.js";

const uctcRouter = Router();

uctcRouter.post("/rules",
    isAuthenticated(),
    isAuthorized([roles.ADMIN, roles.DETECTION_ENGINEER]),
    isValid(createRuleValidation),
    asyncHandler(createRule)
);

uctcRouter.get("/rules",
    isAuthenticated(),
    isAuthorized([roles.ADMIN, roles.DETECTION_ENGINEER, roles.SOC_ANALYST, roles.SOC_MANAGER]),
    asyncHandler(getRules)
);

uctcRouter.post("/rules/:ruleId/deploy",
    isAuthenticated(),
    isAuthorized([roles.ADMIN, roles.SOC_MANAGER]),
    asyncHandler(deployRule)
);

export default uctcRouter;
