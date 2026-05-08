import type { TestResultStatus } from "../protocol/schemas.js";
import type { StaleReason } from "../verify/freshness.js";
import {
  runVerificationScript,
  type RunVerificationOptions,
  type VerificationScriptSelection,
} from "../verify/runner.js";

export type VerificationFreshnessState = "fresh" | "stale";
export type VerifyServiceOptions = RunVerificationOptions;

export interface VerifyServiceResult {
  readonly workspaceRoot: string;
  readonly script: VerificationScriptSelection;
  readonly scriptExitCode: number;
  readonly processExitCode: number;
  readonly verificationStatus: TestResultStatus;
  readonly freshness: VerificationFreshnessState;
  readonly staleReason: StaleReason | null;
  readonly summary: string;
  readonly stdout: string;
  readonly stderr: string;
}

export async function verifyLouisGo(
  options: VerifyServiceOptions = {},
): Promise<VerifyServiceResult> {
  const runResult = await runVerificationScript(options);
  const testResults = runResult.freshness.testResults;

  if (testResults === null) {
    throw new Error("test-results.json is missing after verification");
  }

  const freshness: VerificationFreshnessState =
    runResult.freshness.status === "stale" ? "stale" : "fresh";
  const processExitCode =
    freshness === "fresh" && testResults.status === "passed" && runResult.exitCode === 0
      ? 0
      : normalizeNonZeroExitCode(runResult.exitCode);

  return {
    workspaceRoot: runResult.workspaceRoot,
    script: runResult.script,
    scriptExitCode: runResult.exitCode,
    processExitCode,
    verificationStatus: testResults.status,
    freshness,
    staleReason: runResult.freshness.staleReason,
    summary: testResults.summary,
    stdout: runResult.stdout,
    stderr: runResult.stderr,
  };
}

function normalizeNonZeroExitCode(exitCode: number): number {
  return exitCode === 0 ? 1 : exitCode;
}
