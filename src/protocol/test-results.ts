import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import { testResultsSchema, type TestResults, type TestResultStatus } from "./schemas.js";

export const testResultsErrorCodes = {
  missing: "TEST_RESULTS_MISSING",
  invalid: "TEST_RESULTS_INVALID",
} as const;

export type TestResultsErrorCode =
  (typeof testResultsErrorCodes)[keyof typeof testResultsErrorCodes];

export interface TestResultsInput {
  readonly command: string;
  readonly exitCode: number;
  readonly status: TestResultStatus;
  readonly gitHead: string;
  readonly diffHash: string;
  readonly startedAt: string;
  readonly completedAt: string;
  readonly summary: string;
}

export interface TestResultsJson {
  readonly schema: "louisgo-test-results-v1";
  readonly command: string;
  readonly exit_code: number;
  readonly status: TestResultStatus;
  readonly git_head: string;
  readonly diff_hash: string;
  readonly started_at: string;
  readonly completed_at: string;
  readonly summary: string;
}

export class TestResultsError extends Error {
  readonly code: TestResultsErrorCode;
  readonly filePath: string;
  readonly cause?: unknown;

  constructor(params: {
    readonly code: TestResultsErrorCode;
    readonly filePath: string;
    readonly message: string;
    readonly cause?: unknown;
  }) {
    super(params.message);
    this.name = "TestResultsError";
    this.code = params.code;
    this.filePath = params.filePath;

    if (params.cause !== undefined) {
      this.cause = params.cause;
    }
  }
}

export async function readTestResults(filePath: string): Promise<TestResults> {
  let raw: string;

  try {
    raw = await readFile(filePath, "utf8");
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      throw new TestResultsError({
        code: testResultsErrorCodes.missing,
        filePath,
        message: `验证结果文件不存在：${filePath}`,
        cause: error,
      });
    }

    throw error;
  }

  let json: unknown;

  try {
    json = JSON.parse(raw);
  } catch (error) {
    throw new TestResultsError({
      code: testResultsErrorCodes.invalid,
      filePath,
      message: `test-results.json 格式错误：${filePath}`,
      cause: error,
    });
  }

  try {
    return testResultsSchema.parse(json);
  } catch (error) {
    throw new TestResultsError({
      code: testResultsErrorCodes.invalid,
      filePath,
      message: `test-results.json 格式错误：${filePath}`,
      cause: error,
    });
  }
}

export async function writeTestResults(
  filePath: string,
  input: TestResultsInput,
): Promise<TestResults> {
  const serialized = serializeTestResults(input);
  const parsed = testResultsSchema.parse(serialized);

  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(serialized, null, 2)}\n`, "utf8");

  return parsed;
}

export function serializeTestResults(input: TestResultsInput): TestResultsJson {
  return {
    schema: "louisgo-test-results-v1",
    command: input.command,
    exit_code: input.exitCode,
    status: input.status,
    git_head: input.gitHead,
    diff_hash: input.diffHash,
    started_at: input.startedAt,
    completed_at: input.completedAt,
    summary: input.summary,
  };
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
