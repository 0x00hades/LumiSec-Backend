import { SandboxRun } from "../../../database/index.js";
import { AppError } from "../../utils/appError.js";
import { successResponse, paginatedResponse } from "../../utils/apiResponse.js";
import { sandboxRunStatus, sandboxRunType } from "../../utils/constant/enums.js";
import { getBuiltInScenario, listBuiltInScenarios } from "../../utils/helpers/uctcScenarios.js";
import { runScriptInSandbox } from "../../utils/helpers/sandboxRunner.js";

/**
 * Runs a sandbox job and persists every final state for audit/history views.
 */
const runAndPersist = async (run) => {
    run.status = sandboxRunStatus.RUNNING;
    run.startedAt = new Date();
    await run.save();

    const startedAt = Date.now();

    try {
        const result = await runScriptInSandbox({
            language: run.language,
            script: run.script,
            timeoutSec: run.timeoutSec
        });

        run.status = result.status;
        run.output = result.output;
        run.error = result.error;
        run.exitCode = result.exitCode;
        run.durationMs = result.durationMs;
        // INFRA/CLOUD INTEGRATION: Persist provider/job IDs so a cloud runner can be traced from the API later.
        run.runnerProvider = result.runnerProvider;
        run.runnerJobId = result.runnerJobId;
        run.dockerImage = result.dockerImage;
        run.dockerCommand = result.dockerCommand;
    } catch (error) {
        // Keep failed sandbox attempts visible in history instead of leaving them stuck as "running".
        run.status = sandboxRunStatus.FAILED;
        run.output = "";
        run.error = error.message || "Sandbox execution failed";
        run.exitCode = null;
        run.durationMs = Date.now() - startedAt;
        run.runnerProvider = process.env.UCTC_SANDBOX_MODE || "mock";
    }

    run.completedAt = new Date();
    await run.save();

    return run;
};

/**
 * Executes a custom analyst script in the UCTC sandbox.
 * The helper decides whether this uses mock mode or a real Docker/cloud runner.
 */
export const executeScript = async (req, res, next) => {
    const { language, script, timeout = Number(process.env.UCTC_SANDBOX_TIMEOUT_SEC) || 30 } = req.body;

    const run = new SandboxRun({
        type: sandboxRunType.SCRIPT,
        language,
        script,
        timeoutSec: timeout,
        requestedBy: req.authUser._id
    });

    const completedRun = await runAndPersist(run);

    return successResponse(res, {
        message: "Sandbox script executed",
        data: completedRun,
        statusCode: 201
    });
};

/**
 * Executes one safe built-in attack scenario from the UCTC scenario library.
 */
export const executeScenario = async (req, res, next) => {
    const { scenario_id, timeout = Number(process.env.UCTC_SANDBOX_TIMEOUT_SEC) || 30 } = req.body;
    const scenario = getBuiltInScenario(scenario_id);
    if (!scenario) return next(new AppError("Scenario not found", 404));

    const run = new SandboxRun({
        type: sandboxRunType.SCENARIO,
        language: scenario.language,
        scenarioId: scenario.scenarioId,
        scenarioName: scenario.name,
        script: scenario.script,
        timeoutSec: timeout,
        requestedBy: req.authUser._id
    });

    const completedRun = await runAndPersist(run);

    return successResponse(res, {
        message: "Sandbox scenario executed",
        data: completedRun,
        statusCode: 201
    });
};

/**
 * Lists built-in scenarios without returning script bodies to normal API callers.
 */
export const listScenarios = async (req, res, next) => {
    return successResponse(res, {
        message: "Scenarios fetched",
        data: listBuiltInScenarios()
    });
};

/**
 * Shows recent sandbox runs so the dashboard can present execution history.
 */
export const getSandboxRuns = async (req, res, next) => {
    const { page = 1, limit = 20, status, type, scenarioId } = req.query;
    const skip = (page - 1) * limit;
    const filter = {};
    if (status) filter.status = status;
    if (type) filter.type = type;
    if (scenarioId) filter.scenarioId = scenarioId;

    const [runs, total] = await Promise.all([
        SandboxRun.find(filter).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)).populate("requestedBy", "name email"),
        SandboxRun.countDocuments(filter)
    ]);

    return paginatedResponse(res, {
        message: "Sandbox runs fetched",
        data: runs,
        page: Number(page),
        limit: Number(limit),
        total
    });
};
