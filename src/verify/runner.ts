import { execFile } from "node:child_process";
import { stat } from "node:fs/promises";
import { promisify } from "node:util";

import { findGitRoot } from "../fs/workspace.js";
import { writeTestResults } from "../protocol/test-results.js";
import {
  createProtocolPaths,
  protocolRelativePaths,
  type ProtocolPaths,
} from "../protocol/paths.js";
import { TestResultsError, testResultsErrorCodes } from "../protocol/test-results.js";
import {
  checkVerificationFreshness,
  getCurrentGitSnapshot,
  type VerificationFreshness,
} from "./freshness.js";

const execFileAsync = promisify(execFile);

export const verifyRunnerErrorCodes = {
  scriptMissing: "VERIFY_SCRIPT_MISSING",
  executionFailed: "VERIFY_EXECUTION_FAILED",
  resultMissing: "VERIFY_RESULT_MISSING",
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

  const execution = await executeScript(script, workspaceRoot, options.env);
  const freshness = await readPostRunFreshness(paths, execution, script);

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

  await writeTestResults(paths.testResults, {
    command: "louisgo verify",
    exitCode: 0,
    status: "skipped",
    gitHead: snapshot.gitHead,
    diffHash: snapshot.diffHash,
    startedAt,
    completedAt,
    summary: "未配置项目验证命令，已跳过",
  });

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
    freshness: await checkVerificationFreshness({
      cwd: paths.workspaceRoot,
      testResultsPath: paths.testResults,
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

async function assertScriptFile(script: VerificationScriptSelection): Promise<void> {
  if (await hasScriptFile(script)) {
    return;
  }

  throw new VerifyRunnerError({
    code: verifyRunnerErrorCodes.scriptMissing,
    scriptPath: script.filePath,
    message: `验证脚本不存在：${script.relativePath}`,
  });
}

async function executeScript(
  script: VerificationScriptSelection,
  cwd: string,
  env: NodeJS.ProcessEnv | undefined,
): Promise<ScriptExecutionResult> {
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
    };
  } catch (error) {
    if (isExecError(error) && typeof error.code === "number") {
      return {
        exitCode: error.code,
        stdout: typeof error.stdout === "string" ? error.stdout : "",
        stderr: typeof error.stderr === "string" ? error.stderr : "",
      };
    }

    throw new VerifyRunnerError({
      code: verifyRunnerErrorCodes.executionFailed,
      scriptPath: script.filePath,
      message: `验证脚本执行失败：${script.relativePath}`,
      cause: error,
    });
  }
}

async function readPostRunFreshness(
  paths: ProtocolPaths,
  execution: ScriptExecutionResult,
  script: VerificationScriptSelection,
): Promise<VerificationFreshness> {
  try {
    const freshness = await checkVerificationFreshness({
      cwd: paths.workspaceRoot,
      testResultsPath: paths.testResults,
    });

    if (freshness.status !== "missing") {
      return freshness;
    }

    throw createResultMissingError(script, execution);
  } catch (error) {
    if (error instanceof TestResultsError && error.code === testResultsErrorCodes.invalid) {
      throw new VerifyRunnerError({
        code: verifyRunnerErrorCodes.resultInvalid,
        scriptPath: script.filePath,
        exitCode: execution.exitCode,
        stdout: execution.stdout,
        stderr: execution.stderr,
        message: "验证脚本生成了非法 test-results.json",
        cause: error,
      });
    }

    throw error;
  }
}

function createResultMissingError(
  script: VerificationScriptSelection,
  execution: ScriptExecutionResult,
): VerifyRunnerError {
  return new VerifyRunnerError({
    code: verifyRunnerErrorCodes.resultMissing,
    scriptPath: script.filePath,
    exitCode: execution.exitCode,
    stdout: execution.stdout,
    stderr: execution.stderr,
    message: "验证脚本未生成 .louisgo/test-results.json",
  });
}

function isExecError(error: unknown): error is {
  readonly code?: unknown;
  readonly stdout?: unknown;
  readonly stderr?: unknown;
} {
  return typeof error === "object" && error !== null;
}
