import { Router } from "express";
import { isValid } from "../../middleware/validation.js";
import { asyncHandler } from "../../middleware/asyncHandler.js";
import { isAuthenticated } from "../../middleware/authentication.js";
import { isServiceOrUserAuthenticated } from "../../middleware/serviceAuth.js";
import { isAuthorized } from "../../middleware/authorization.js";
import { roles } from "../../utils/constant/enums.js";
import {
    applyTuningValidation,
    convertRuleValidation,
    convertSavedRuleValidation,
    createRuleValidation,
    executeScenarioValidation,
    executeScriptValidation,
    ingestAlertFeedbackValidation,
    listSandboxRunsValidation,
    listRulesValidation,
    noisyRulesValidation,
    ruleIdValidation,
    suggestRulesFromNetworkValidation,
    tuningSuggestionsValidation,
    updateRuleValidation,
    uctcGrcGapValidation,
    uctcNetworkCoverageValidation,
    uctcOpenCtiIocValidation,
    uctcSiemDeployValidation,
    uctcSoarIncidentValidation,
    validateRuleValidation
} from "./uctc.validation.js";
import {
    archiveRule,
    convertRule,
    convertSavedRule,
    createRule,
    deployRule,
    getRuleById,
    getRules,
    suggestRulesFromNetwork,
    updateRule,
    validateRule,
    integrateGrcGap,
    integrateSoarIncident,
    integrateNetworkCoverage,
    integrateSiemDeploy,
    integrateOpenCtiIoc
} from "./uctc.controller.js";
import {
    executeScenario,
    executeScript,
    getSandboxRuns,
    listScenarios
} from "./uctc.lab.controller.js";
import {
    applyTuning,
    getDashboardStats,
    getNoisyRules,
    getTuningSuggestions,
    ingestAlertFeedback
} from "./uctc.tuning.controller.js";

const uctcRouter = Router();

uctcRouter.use(isAuthenticated());

const canReadRules = isAuthorized([roles.ADMIN, roles.DETECTION_ENGINEER, roles.SOC_ANALYST, roles.SOC_MANAGER]);
const canWriteRules = isAuthorized([roles.ADMIN, roles.DETECTION_ENGINEER]);
const canApproveRules = isAuthorized([roles.ADMIN, roles.SOC_MANAGER]);
const canRunLab = isAuthorized([roles.ADMIN, roles.DETECTION_ENGINEER, roles.RED_TEAM, roles.SOC_ANALYST]);
const canReadLab = isAuthorized([roles.ADMIN, roles.DETECTION_ENGINEER, roles.RED_TEAM, roles.SOC_ANALYST, roles.SOC_MANAGER]);
const canTuneRules = isAuthorized([roles.ADMIN, roles.DETECTION_ENGINEER, roles.SOC_ANALYST, roles.SOC_MANAGER]);

// Validates Sigma YAML and returns errors/warnings without saving anything.
uctcRouter.post("/rules/validate",
    canWriteRules,
    isValid(validateRuleValidation),
    asyncHandler(validateRule)
);

// Converts unsaved Sigma YAML into SIEM query formats for preview.
uctcRouter.post("/rules/convert",
    canWriteRules,
    isValid(convertRuleValidation),
    asyncHandler(convertRule)
);

// Creates a saved Sigma rule using the canonical REST path.
uctcRouter.post("/rules",
    canWriteRules,
    isValid(createRuleValidation),
    asyncHandler(createRule)
);

// Creates a saved Sigma rule using the path documented in the original UCTC PDF.
uctcRouter.post("/rules/save",
    canWriteRules,
    isValid(createRuleValidation),
    asyncHandler(createRule)
);

// Lists saved Sigma rules with dashboard and archive filters.
uctcRouter.get("/rules",
    canReadRules,
    isValid(listRulesValidation),
    asyncHandler(getRules)
);

// Lists saved Sigma rules using the path documented in the original UCTC PDF.
uctcRouter.get("/rules/list",
    canReadRules,
    isValid(listRulesValidation),
    asyncHandler(getRules)
);

// Uses LumiNet asset context to suggest rule ideas for UCTC detection engineering.
uctcRouter.post("/rules/suggest-from-network",
    canWriteRules,
    isValid(suggestRulesFromNetworkValidation),
    asyncHandler(suggestRulesFromNetwork)
);

// Fetches one saved Sigma rule by MongoDB rule ID.
uctcRouter.get("/rules/:ruleId",
    canReadRules,
    isValid(ruleIdValidation),
    asyncHandler(getRuleById)
);

// Re-converts a saved Sigma rule when the analyst changes target SIEMs.
uctcRouter.post("/rules/:ruleId/convert",
    canWriteRules,
    isValid(convertSavedRuleValidation),
    asyncHandler(convertSavedRule)
);

// Updates editable metadata or YAML for a saved rule.
uctcRouter.patch("/rules/:ruleId",
    canWriteRules,
    isValid(updateRuleValidation),
    asyncHandler(updateRule)
);

// Marks a converted rule as deployed until real SIEM push integration is connected.
uctcRouter.post("/rules/:ruleId/deploy",
    canApproveRules,
    isValid(ruleIdValidation),
    asyncHandler(deployRule)
);

// Retires a rule while keeping its historical record.
uctcRouter.patch("/rules/:ruleId/archive",
    canWriteRules,
    isValid(ruleIdValidation),
    asyncHandler(archiveRule)
);

// Runs an analyst-provided script in mock mode or the isolated sandbox runner.
uctcRouter.post("/lab/execute-script",
    canRunLab,
    isValid(executeScriptValidation),
    asyncHandler(executeScript)
);

// Runs a built-in safe attack simulation scenario in the sandbox runner.
uctcRouter.post("/lab/execute-scenario",
    canRunLab,
    isValid(executeScenarioValidation),
    asyncHandler(executeScenario)
);

// Lists sandbox execution history for auditing and dashboard views.
uctcRouter.get("/lab/runs",
    canReadLab,
    isValid(listSandboxRunsValidation),
    asyncHandler(getSandboxRuns)
);

// Lists available built-in scenarios without exposing their script bodies.
uctcRouter.get("/scenarios/list",
    canReadLab,
    asyncHandler(listScenarios)
);

// Lists rules that are noisy based on stored false-positive feedback.
uctcRouter.get("/tuning/noisy-rules",
    canReadRules,
    isValid(noisyRulesValidation),
    asyncHandler(getNoisyRules)
);

// Generates tuning suggestions for one Sigma rule.
uctcRouter.get("/tuning/suggestions",
    canReadRules,
    isValid(tuningSuggestionsValidation),
    asyncHandler(getTuningSuggestions)
);

// Saves an analyst-approved exclusion query for a noisy rule.
uctcRouter.post("/tuning/apply",
    canWriteRules,
    isValid(applyTuningValidation),
    asyncHandler(applyTuning)
);

// Ingests alert feedback from analysts or future SIEM webhook integrations.
uctcRouter.post("/tuning/alerts/ingest",
    canTuneRules,
    isValid(ingestAlertFeedbackValidation),
    asyncHandler(ingestAlertFeedback)
);

const canIntegrate = isAuthorized([roles.ADMIN, roles.SOC_MANAGER, roles.DETECTION_ENGINEER, roles.INTEGRATION_ADMIN]);

// Returns compact metrics for the UCTC dashboard.
uctcRouter.get("/dashboard/stats",
    canReadRules,
    asyncHandler(getDashboardStats)
);

// ─── Integrations ────────────────────────────────────────────────────────────
uctcRouter.post("/integrations/grc/gap",
    isServiceOrUserAuthenticated(), canIntegrate, isValid(uctcGrcGapValidation),
    asyncHandler(integrateGrcGap)
);
uctcRouter.post("/integrations/soar/incident",
    isServiceOrUserAuthenticated(), canIntegrate, isValid(uctcSoarIncidentValidation),
    asyncHandler(integrateSoarIncident)
);
uctcRouter.post("/integrations/network/coverage",
    isServiceOrUserAuthenticated(), canIntegrate, isValid(uctcNetworkCoverageValidation),
    asyncHandler(integrateNetworkCoverage)
);
uctcRouter.post("/integrations/siem/deploy",
    isServiceOrUserAuthenticated(), canIntegrate, isValid(uctcSiemDeployValidation),
    asyncHandler(integrateSiemDeploy)
);
uctcRouter.post("/integrations/opencti/ioc",
    isServiceOrUserAuthenticated(), canIntegrate, isValid(uctcOpenCtiIocValidation),
    asyncHandler(integrateOpenCtiIoc)
);

export default uctcRouter;
