import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  readTestResults,
  TestResultsError,
  testResultsErrorCodes,
  writeTestResults,
} from "../src/protocol/test-results.js";

const timestamp = "2026-05-01T20:00:00+08:00";

describe("test-results.json 协议读写", () => {
  it("可以写入 snake_case JSON 并读取为内部结构", async () => {
    await using tempDir = await createTempDir();
    const filePath = join(tempDir.path, ".louisgo", "test-results.json");

    const written = await writeTestResults(filePath, {
      command: ".louisgo/scripts/verify.sh",
      exitCode: 0,
      status: "passed",
      gitHead: "abc123",
      diffHash: "def456",
      startedAt: timestamp,
      completedAt: "2026-05-01T20:01:00+08:00",
      summary: "验证通过",
    });
    const raw = JSON.parse(await readFile(filePath, "utf8")) as Record<string, unknown>;

    expect(raw).toMatchObject({
      schema: "louisgo-test-results-v1",
      exit_code: 0,
      git_head: "abc123",
      diff_hash: "def456",
      started_at: timestamp,
    });
    expect(raw).not.toHaveProperty("exitCode");
    await expect(readTestResults(filePath)).resolves.toEqual(written);
  });

  it("拒绝非法 schema", async () => {
    await using tempDir = await createTempDir();
    const filePath = join(tempDir.path, ".louisgo", "test-results.json");

    await mkdir(join(tempDir.path, ".louisgo"), { recursive: true });
    await writeFile(
      filePath,
      JSON.stringify({
        schema: "wrong-schema",
        command: ".louisgo/scripts/verify.sh",
        exit_code: 0,
        status: "passed",
        git_head: "abc123",
        diff_hash: "def456",
        started_at: timestamp,
        completed_at: "2026-05-01T20:01:00+08:00",
        summary: "验证通过",
      }),
      "utf8",
    );

    await expect(readTestResults(filePath)).rejects.toSatisfy(
      (error: unknown) =>
        error instanceof TestResultsError && error.code === testResultsErrorCodes.invalid,
    );
  });

  it("缺失文件返回明确错误", async () => {
    await using tempDir = await createTempDir();
    const filePath = join(tempDir.path, ".louisgo", "test-results.json");

    await expect(readTestResults(filePath)).rejects.toSatisfy(
      (error: unknown) =>
        error instanceof TestResultsError && error.code === testResultsErrorCodes.missing,
    );
  });
});

interface TempDir extends AsyncDisposable {
  readonly path: string;
}

async function createTempDir(): Promise<TempDir> {
  const path = await mkdtemp(join(tmpdir(), "louisgo-"));

  return {
    path,
    async [Symbol.asyncDispose]() {
      await rm(path, { force: true, recursive: true });
    },
  };
}
