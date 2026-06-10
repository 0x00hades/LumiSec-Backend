import { spawn } from "child_process";
import { chmod, mkdtemp, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import { sandboxRunStatus } from "../constant/enums.js";

const DEFAULT_TIMEOUT_SEC = 30;
const DEFAULT_MAX_OUTPUT_BYTES = 50000;

const languageConfig = {
    powershell: {
        extension: "ps1",
        command: (filePath) => ["pwsh", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", filePath],
        envImage: "UCTC_SANDBOX_POWERSHELL_IMAGE",
        defaultImage: "mcr.microsoft.com/powershell:latest"
    },
    python: {
        extension: "py",
        command: (filePath) => ["python", filePath],
        envImage: "UCTC_SANDBOX_PYTHON_IMAGE",
        defaultImage: "python:3.12-alpine"
    },
    bash: {
        extension: "sh",
        command: (filePath) => ["bash", filePath],
        envImage: "UCTC_SANDBOX_BASH_IMAGE",
        defaultImage: "bash:5.2"
    }
};

/**
 * Executes analyst scripts inside a restricted Docker container.
 * Use UCTC_SANDBOX_MODE=mock when Docker/cloud runners are not available locally.
 */
export const runScriptInSandbox = async ({ language, script, timeoutSec = DEFAULT_TIMEOUT_SEC }) => {
    const config = languageConfig[language];
    if (!config) {
        throw new Error(`Unsupported sandbox language: ${language}`);
    }

    const sandboxMode = process.env.UCTC_SANDBOX_MODE || "mock";
    if (sandboxMode === "mock") {
        return runMockSandbox({ language, script, timeoutSec, config });
    }
    if (sandboxMode !== "docker") {
        throw new Error(`Unsupported UCTC_SANDBOX_MODE: ${sandboxMode}`);
    }

    const startedAt = Date.now();
    const tempDir = await mkdtemp(path.join(tmpdir(), "uctc-sandbox-"));
    const scriptFilename = `script.${config.extension}`;
    const hostScriptPath = path.join(tempDir, scriptFilename);
    const containerScriptPath = `/workspace/${scriptFilename}`;

    try {
        await writeFile(hostScriptPath, script, "utf8");
        // INFRA/CLOUD INTEGRATION: Cloud runners may use a non-root container user, so the mounted script must be readable.
        await chmod(tempDir, 0o755);
        await chmod(hostScriptPath, 0o444);

        // INFRA/CLOUD INTEGRATION: This image must be pre-pulled or reachable from the Docker/cloud runner.
        const image = process.env[config.envImage] || config.defaultImage;
        const languageCommand = config.command(containerScriptPath);

        // INFRA/CLOUD INTEGRATION: These resource limits should match the final cloud sandbox capacity.
        const memoryLimit = process.env.UCTC_SANDBOX_MEMORY || "512m";
        // INFRA/CLOUD INTEGRATION: CPU limits protect the shared cloud host from runaway test scripts.
        const cpuLimit = process.env.UCTC_SANDBOX_CPUS || "1";
        // INFRA/CLOUD INTEGRATION: PID limits reduce fork-bomb risk on the cloud runner.
        const pidsLimit = process.env.UCTC_SANDBOX_PIDS_LIMIT || "128";
        // INFRA/CLOUD INTEGRATION: Run sandbox code as an unprivileged container user on the cloud runner.
        const containerUser = process.env.UCTC_SANDBOX_USER || "1000:1000";
        // INFRA/CLOUD INTEGRATION: This bind mount is the local Docker path; cloud runners may replace it with object storage.
        const workspaceMount = `type=bind,source=${tempDir},target=/workspace,readonly`;

        // INFRA/CLOUD INTEGRATION: Docker is the isolation boundary; replace this command with the cloud runner API later.
        const dockerArgs = [
            "run",
            "--rm",
            "--network",
            "none",
            "--memory",
            memoryLimit,
            "--cpus",
            cpuLimit,
            "--pids-limit",
            pidsLimit,
            "--cap-drop",
            "ALL",
            "--security-opt",
            "no-new-privileges",
            "--user",
            containerUser,
            "--read-only",
            "--tmpfs",
            "/tmp:rw,noexec,nosuid,size=64m",
            "--mount",
            workspaceMount,
            image,
            ...languageCommand
        ];

        // INFRA/CLOUD INTEGRATION: This starts the sandbox container on the local/cloud Docker host.
        const result = await runDockerProcess(dockerArgs, Number(timeoutSec));

        return {
            ...result,
            runnerProvider: "docker-local",
            runnerJobId: null,
            dockerImage: image,
            dockerCommand: ["docker", ...dockerArgs],
            durationMs: Date.now() - startedAt
        };
    } finally {
        await rm(tempDir, { recursive: true, force: true });
    }
};

/**
 * Mock mode keeps local development and API tests fast before Docker/cloud is ready.
 */
const runMockSandbox = async ({ language, script, timeoutSec, config }) => {
    const startedAt = Date.now();
    const preview = script.split("\n").map((line) => line.trim()).filter(Boolean).slice(0, 8).join("\n");

    return {
        status: sandboxRunStatus.SUCCEEDED,
        output: `MOCK_SANDBOX_EXECUTION\nlanguage=${language}\ntimeout=${timeoutSec}\n--- script preview ---\n${preview}`,
        error: "",
        exitCode: 0,
        runnerProvider: "mock",
        runnerJobId: null,
        dockerImage: `mock/${language}`,
        dockerCommand: ["mock-sandbox", language, `script.${config.extension}`],
        durationMs: Date.now() - startedAt
    };
};

/**
 * Spawns Docker with a hard timeout and bounded output buffers.
 */
const runDockerProcess = (dockerArgs, timeoutSec) => {
    return new Promise((resolve) => {
        const maxOutputBytes = Number(process.env.UCTC_MAX_OUTPUT_BYTES) || DEFAULT_MAX_OUTPUT_BYTES;
        let output = "";
        let error = "";
        let timedOut = false;

        // INFRA/CLOUD INTEGRATION: This process call depends on Docker availability on the host or cloud VM.
        const child = spawn("docker", dockerArgs, { windowsHide: true });

        const timer = setTimeout(() => {
            timedOut = true;
            child.kill("SIGKILL");
        }, timeoutSec * 1000);

        child.stdout.on("data", (chunk) => {
            output = appendBounded(output, chunk.toString(), maxOutputBytes);
        });

        child.stderr.on("data", (chunk) => {
            error = appendBounded(error, chunk.toString(), maxOutputBytes);
        });

        child.on("error", (spawnError) => {
            clearTimeout(timer);
            resolve({
                status: sandboxRunStatus.FAILED,
                output,
                error: spawnError.message,
                exitCode: null
            });
        });

        child.on("close", (exitCode) => {
            clearTimeout(timer);
            resolve({
                status: timedOut ? sandboxRunStatus.TIMED_OUT : exitCode === 0 ? sandboxRunStatus.SUCCEEDED : sandboxRunStatus.FAILED,
                output,
                error,
                exitCode
            });
        });
    });
};

const appendBounded = (currentValue, nextValue, maxBytes) => {
    const merged = currentValue + nextValue;
    if (Buffer.byteLength(merged) <= maxBytes) return merged;
    return merged.slice(0, maxBytes) + "\n[output truncated]";
};
