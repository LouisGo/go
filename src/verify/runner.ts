import { execFile } from "node:child_process";
import { stat } from "node:fs/promises";
import { promisify } from "node:util";

import { findGitRoot } from "../fs/workspace.js";
import {
  createProtocolPaths,
  protocolRelativePaths,
  type ProtocolPaths,
} from "../protocol/paths.js";
import {
  readTestResults,
  serializeTestResults,
  TestResultsError,
  testResultsErrorCodes,
} from "../protocol/test-results.js";
import { testResultsSchema, type TestResultStatus, type TestResults } from "../protocol/schemas.js";
import {
  checkTestResultsFreshness,
  getCurrentGitSnapshot,
  type VerificationFreshness,
} from "./freshness.js";

const execFileAsync = promisify(execFile);

export const verifyRunnerErrorCodes = {
  scriptMissing: "VERIFY_SCRIPT_MISSING",
  executionFailed: "VERIFY_EXECUTION_FAILED",
  resultInvalid: "VERIFY_RESULT_INVALID",
} as const;

export type VerifyRunnerErrorCode =
  (typeof verifyRunnerErrorCodes)[keyof typeof verifyRunnerErrorCodes];

export type VerificationScriptKind = "sh" | "ps1";
export type VerificationEntryKind = VerificationScriptKind | "global";

export interface VerificationScriptSelection {
  readonly kind: VerificationEntryKind;
  readonly filePath: string;
  readonly relativePath: string;
  readonly command: string;
  readonly args: readonly string[];
}

export interface RunVerificationOptions {
  readonly cwd?: string;
  readonly platform?: NodeJS.Platform;
  readonly env?: NodeJS.ProcessEnv;
}

export interface RunVerificationResult {
  readonly workspaceRoot: string;
  readonly script: VerificationScriptSelection;
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
  readonly freshness: VerificationFreshness;
}

export class VerifyRunnerError extends Error {
  readonly code: VerifyRunnerErrorCode;
  readonly scriptPath?: string;
  readonly exitCode?: number;
  readonly stdout?: string;
  readonly stderr?: string;
  readonly cause?: unknown;

  constructor(params: {
    readonly code: VerifyRunnerErrorCode;
    readonly message: string;
    readonly scriptPath?: string;
    readonly exitCode?: number;
    readonly stdout?: string;
    readonly stderr?: string;
    readonly cause?: unknown;
  }) {
    super(params.message);
    this.name = "VerifyRunnerError";
    this.code = params.code;

    if (params.scriptPath !== undefined) {
      this.scriptPath = params.scriptPath;
    }

    if (params.exitCode !== undefined) {
      this.exitCode = params.exitCode;
    }

    if (params.stdout !== undefined) {
      this.stdout = params.stdout;
    }

    if (params.stderr !== undefined) {
      this.stderr = params.stderr;
    }

    if (params.cause !== undefined) {
      this.cause = params.cause;
    }
  }
}

export async function runVerificationScript(
  options: RunVerificationOptions = {},
): Promise<RunVerificationResult> {
  const workspaceRoot = await findGitRoot(options.cwd);
  const paths = createProtocolPaths(workspaceRoot);
  const script = selectVerificationScript(paths, options.platform ?? process.platform);

  if (!(await hasScriptFile(script))) {
    return await runGlobalSkippedVerification(paths);
  }

  const beforeCompatibilityResult = await statIfExists(paths.testResults);
  const execution = await executeScript(script, workspaceRoot, options.env);
  const testResults = await resolveScriptTestResults(
    paths,
    script,
    execution,
    beforeCompatibilityResult,
  );
  const freshness = await checkTestResultsFreshness({
    cwd: paths.workspaceRoot,
    testResults,
  });

  return {
    workspaceRoot,
    script,
    exitCode: execution.exitCode,
    stdout: execution.stdout,
    stderr: execution.stderr,
    freshness,
  };
}

async function runGlobalSkippedVerification(paths: ProtocolPaths): Promise<RunVerificationResult> {
  const startedAt = new Date().toISOString();
  const snapshot = await getCurrentGitSnapshot({ cwd: paths.workspaceRoot });
  const completedAt = new Date().toISOString();
  const testResults = testResultsSchema.parse(
    serializeTestResults({
      command: "louisgo verify",
      exitCode: 0,
      status: "skipped",
      gitHead: snapshot.gitHead,
      diffHash: snapshot.diffHash,
      startedAt,
      completedAt,
      summary: "No project verification command configured; skipped",
    }),
  );

  return {
    workspaceRoot: paths.workspaceRoot,
    script: {
      kind: "global",
      filePath: "",
      relativePath: "louisgo verify",
      command: "louisgo",
      args: ["verify"],
    },
    exitCode: 0,
    stdout: "",
    stderr: "",
    freshness: await checkTestResultsFreshness({
      cwd: paths.workspaceRoot,
      testResults,
    }),
  };
}

export function selectVerificationScript(
  paths: ProtocolPaths,
  platform: NodeJS.Platform,
): VerificationScriptSelection {
  if (platform === "win32") {
    return {
      kind: "ps1",
      filePath: paths.verifyPs1,
      relativePath: protocolRelativePaths.verifyPs1,
      command: "powershell.exe",
      args: ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", paths.verifyPs1],
    };
  }

  return {
    kind: "sh",
    filePath: paths.verifySh,
    relativePath: protocolRelativePaths.verifySh,
    command: "sh",
    args: [paths.verifySh],
  };
}

interface ScriptExecutionResult {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
  readonly startedAt: string;
  readonly completedAt: string;
}

async function hasScriptFile(script: VerificationScriptSelection): Promise<boolean> {
  try {
    const scriptStat = await stat(script.filePath);

    if (scriptStat.isFile()) {
      return true;
    }
  } catch {
    return false;
  }

  return false;
}

async function executeScript(
  script: VerificationScriptSelection,
  cwd: string,
  env: NodeJS.ProcessEnv | undefined,
): Promise<ScriptExecutionResult> {
  const startedAt = new Date().toISOString();

  try {
    const result = await execFileAsync(script.command, [...script.args], {
      cwd,
      encoding: "utf8",
      env: { ...process.env, ...env },
      maxBuffer: 20 * 1024 * 1024,
    });

    return {
      exitCode: 0,
      stdout: result.stdout,
      stderr: result.stderr,
      startedAt,
      completedAt: new Date().toISOString(),
    };
  } catch (error) {
    if (isExecError(error) && typeof error.code === "number") {
      return {
        exitCode: error.code,
        stdout: typeof error.stdout === "string" ? error.stdout : "",
        stderr: typeof error.stderr === "string" ? error.stderr : "",
        startedAt,
        completedAt: new Date().toISOString(),
      };
    }

    throw new VerifyRunnerError({
      code: verifyRunnerErrorCodes.executionFailed,
      scriptPath: script.filePath,
      message: `Verification script execution failed: ${script.relativePath}`,
      cause: error,
    });
  }
}

async function resolveScriptTestResults(
  paths: ProtocolPaths,
  script: VerificationScriptSelection,
  execution: ScriptExecutionResult,
  beforeCompatibilityResult: FileFingerprint | null,
): Promise<TestResults> {
  const stdoutResult = parseStdoutTestResults(execution.stdout);

  if (stdoutResult !== null) {
    return stdoutResult;
  }

  if (await compatibilityResultChanged(paths.testResults, beforeCompatibilityResult)) {
    try {
      return await readTestResults(paths.testResults);
    } catch (error) {
      if (error instanceof TestResultsError && error.code === testResultsErrorCodes.invalid) {
        throw new VerifyRunnerError({
          code: verifyRunnerErrorCodes.resultInvalid,
          scriptPath: script.filePath,
          exitCode: execution.exitCode,
          stdout: execution.stdout,
          stderr: execution.stderr,
          message: "Verification script generated an invalid compatibility test-results.json",
          cause: error,
        });
      }

      if (!(error instanceof TestResultsError && error.code === testResultsErrorCodes.missing)) {
        throw error;
      }
    }
  }

  return await synthesizeTestResults(paths, script, execution);
}

function parseStdoutTestResults(stdout: string): TestResults | null {
  for (const line of stdout.split(/\r?\n/)) {
    const trimmed = line.trim();

    if (!trimmed.startsWith("{") || !trimmed.includes("louisgo-test-results-v1")) {
      continue;
    }

    try {
      return testResultsSchema.parse(JSON.parse(trimmed));
    } catch (error) {
      throw new VerifyRunnerError({
        code: verifyRunnerErrorCodes.resultInvalid,
        stdout,
        message: "Verification script printed an invalid louisgo-test-results-v1 JSON result",
        cause: error,
      });
    }
  }

  return null;
}

async function synthesizeTestResults(
  paths: ProtocolPaths,
  script: VerificationScriptSelection,
  execution: ScriptExecutionResult,
): Promise<TestResults> {
  const snapshot = await getCurrentGitSnapshot({ cwd: paths.workspaceRoot });
  const status: TestResultStatus = execution.exitCode === 0 ? "passed" : "failed";

  return testResultsSchema.parse(
    serializeTestResults({
      command: script.relativePath,
      exitCode: execution.exitCode,
      status,
      gitHead: snapshot.gitHead,
      diffHash: snapshot.diffHash,
      startedAt: execution.startedAt,
      completedAt: execution.completedAt,
      summary: createSyntheticSummary(status, execution),
    }),
  );
}

function createSyntheticSummary(
  status: TestResultStatus,
  execution: ScriptExecutionResult,
): string {
  return (
    firstMeaningfulLine(execution.stdout) ??
    firstMeaningfulLine(execution.stderr) ??
    (status === "passed"
      ? "Verification script completed successfully"
      : `Verification script failed with exit code ${execution.exitCode}`)
  );
}

function firstMeaningfulLine(value: string): string | null {
  const line = value
    .split(/\r?\n/)
    .map((item) => item.trim())
    .find((item) => item.length > 0);

  return line ?? null;
}

interface FileFingerprint {
  readonly size: number;
  readonly mtimeMs: number;
}

async function statIfExists(filePath: string): Promise<FileFingerprint | null> {
  try {
    const fileStat = await stat(filePath);
    return {
      size: fileStat.size,
      mtimeMs: fileStat.mtimeMs,
    };
  } catch {
    return null;
  }
}

async function compatibilityResultChanged(
  filePath: string,
  before: FileFingerprint | null,
): Promise<boolean> {
  const after = await statIfExists(filePath);

  if (after === null) {
    return false;
  }

  return before === null || after.size !== before.size || after.mtimeMs !== before.mtimeMs;
}

function isExecError(error: unknown): error is {
  readonly code?: unknown;
  readonly stdout?: unknown;
  readonly stderr?: unknown;
} {
  return typeof error === "object" && error !== null;
}
