import { getGitHead, type GitCommandOptions } from "../git/git.js";
import { computeDiffHash } from "../git/diff-hash.js";
import {
  readTestResults,
  TestResultsError,
  testResultsErrorCodes,
} from "../protocol/test-results.js";
import type { GitSnapshot, TestResults, VerificationStatus } from "../protocol/schemas.js";

export type StaleReason = "git_head_mismatch" | "diff_hash_mismatch";

export interface VerificationFreshness {
  readonly status: VerificationStatus;
  readonly testResults: TestResults | null;
  readonly currentSnapshot: GitSnapshot | null;
  readonly staleReason: StaleReason | null;
}

export interface CheckVerificationFreshnessOptions extends GitCommandOptions {
  readonly testResultsPath: string;
}

export interface CheckTestResultsFreshnessOptions extends GitCommandOptions {
  readonly testResults: TestResults;
}

export async function checkVerificationFreshness(
  options: CheckVerificationFreshnessOptions,
): Promise<VerificationFreshness> {
  let testResults: TestResults;

  try {
    testResults = await readTestResults(options.testResultsPath);
  } catch (error) {
    if (error instanceof TestResultsError && error.code === testResultsErrorCodes.missing) {
      return {
        status: "missing",
        testResults: null,
        currentSnapshot: null,
        staleReason: null,
      };
    }

    throw error;
  }

  return await checkTestResultsFreshness({ ...options, testResults });
}

export async function checkTestResultsFreshness(
  options: CheckTestResultsFreshnessOptions,
): Promise<VerificationFreshness> {
  const currentSnapshot = await getCurrentGitSnapshot(options);
  const staleReason = getStaleReason(options.testResults, currentSnapshot);

  if (staleReason !== null) {
    return {
      status: "stale",
      testResults: options.testResults,
      currentSnapshot,
      staleReason,
    };
  }

  return {
    status: options.testResults.status,
    testResults: options.testResults,
    currentSnapshot,
    staleReason: null,
  };
}

export async function getCurrentGitSnapshot(options: GitCommandOptions = {}): Promise<GitSnapshot> {
  const [gitHead, diffHash] = await Promise.all([getGitHead(options), computeDiffHash(options)]);

  return {
    gitHead,
    diffHash,
  };
}

function getStaleReason(
  testResults: TestResults,
  currentSnapshot: GitSnapshot,
): StaleReason | null {
  if (testResults.gitHead !== currentSnapshot.gitHead) {
    return "git_head_mismatch";
  }

  if (testResults.diffHash !== currentSnapshot.diffHash) {
    return "diff_hash_mismatch";
  }

  return null;
}
