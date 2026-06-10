import { Router } from "express";
import { isValid } from "../../middleware/validation.js";
import { asyncHandler } from "../../middleware/asyncHandler.js";
import { isAuthenticated } from "../../middleware/authentication.js";
import { isAuthorized } from "../../middleware/authorization.js";
import { roles } from "../../utils/constant/enums.js";
import { createFindingValidation, createTaskValidation } from "./grc.validation.js";
import { createFinding, createRemediationTask, closeFinding, getFindings } from "./grc.controller.js";

const grcRouter = Router();

grcRouter.post("/findings",
    isAuthenticated(),
    isAuthorized([roles.ADMIN, roles.AUDITOR]),
    isValid(createFindingValidation),
    asyncHandler(createFinding)
);

grcRouter.get("/findings",
    isAuthenticated(),
    isAuthorized([roles.ADMIN, roles.AUDITOR, roles.COMPLIANCE_MANAGER, roles.IT_MANAGER]),
    asyncHandler(getFindings)
);

grcRouter.patch("/findings/:findingId/close",
    isAuthenticated(),
    isAuthorized([roles.ADMIN, roles.AUDITOR]),
    asyncHandler(closeFinding)
);

grcRouter.post("/tasks",
    isAuthenticated(),
    isAuthorized([roles.ADMIN, roles.IT_MANAGER]),
    isValid(createTaskValidation),
    asyncHandler(createRemediationTask)
);

export default grcRouter;
