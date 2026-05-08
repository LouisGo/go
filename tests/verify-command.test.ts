import { execFile } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Writable } from "node:stream";
import { promisify } from "node:util";

import { describe, expect, it } from "vitest";

import { createCli } from "../src/cli.js";
import { createProtocolPaths } from "../src/protocol/paths.js";
import type { TestResultStatus } from "../src/protocol/schemas.js";
import { getCurrentGitSnapshot } from "../src/verify/freshness.js";

const execFileAsync = promisify(execFile);
const timestamp = "2026-05-01T20:00:00+08:00";
const completedAt = "2026-05-01T20:01:00+08:00";

describe("verify 命令", () => {
  it("验证通过时输出状态并返回 0", async () => {
    await using repo = await createGitRepo();
    const context = await prepareVerifyScript(repo.path);
    let exitCode = -1;
    const stdout = new MemoryWritable();
    const stderr = new MemoryWritable();
    const program = createCli({
      cwd: repo.path,
      stdout,
      stderr,
      platform: "darwin",
      env: createResultEnv({
        snapshot: context.snapshot,
        status: "passed",
        exitCode: 0,
      }),
      setExitCode: (code) => {
        exitCode = code;
      },
    });

    await program.parseAsync(["node", "louisgo", "verify"]);

    expect(exitCode).toBe(0);
    expect(stderr.text).toBe("");
    expect(stdout.text).toContain("Verification status: passed");
    expect(stdout.text).toContain("Freshness: fresh");
    expect(stdout.text).toContain("Result: verification passed and is fresh");
  });

  it("验证失败时输出状态并返回非零退出码", async () => {
    await using repo = await createGitRepo();
    const context = await prepareVerifyScript(repo.path);
    let exitCode = -1;
    const stdout = new MemoryWritable();
    const program = createCli({
      cwd: repo.path,
      stdout,
      platform: "darwin",
      env: createResultEnv({
        snapshot: context.snapshot,
        status: "failed",
        exitCode: 7,
      }),
      setExitCode: (code) => {
        exitCode = code;
      },
    });

    await program.parseAsync(["node", "louisgo", "verify"]);

    expect(exitCode).toBe(7);
    expect(stdout.text).toContain("Entry exit code: 7");
    expect(stdout.text).toContain("Verification status: failed");
    expect(stdout.text).toContain("Freshness: fresh");
  });

  it("验证结果过期时输出 stale 并返回非零退出码", async () => {
    await using repo = await createGitRepo();
    const context = await prepareVerifyScript(repo.path, { staleAfterWrite: true });
    let exitCode = -1;
    const stdout = new MemoryWritable();
    const program = createCli({
      cwd: repo.path,
      stdout,
      platform: "darwin",
      env: createResultEnv({
        snapshot: context.snapshot,
        status: "passed",
        exitCode: 0,
      }),
      setExitCode: (code) => {
        exitCode = code;
      },
    });

    await program.parseAsync(["node", "louisgo", "verify"]);

    expect(exitCode).toBe(1);
    expect(stdout.text).toContain("Verification status: passed");
    expect(stdout.text).toContain("Freshness: stale");
    expect(stdout.text).toContain("Stale reason: diff_hash mismatch");
  });

  it("没有项目脚本时由全局 verify 写入 skipped 结果", async () => {
    await using repo = await createGitRepo();
    let exitCode = -1;
    const stdout = new MemoryWritable();
    const stderr = new MemoryWritable();
    const program = createCli({
      cwd: repo.path,
      stdout,
      stderr,
      platform: "darwin",
      setExitCode: (code) => {
        exitCode = code;
      },
    });

    await program.parseAsync(["node", "louisgo", "verify"]);

    expect(exitCode).toBe(1);
    expect(stderr.text).toBe("");
    expect(stdout.text).toContain("Verification entry: louisgo verify");
    expect(stdout.text).toContain("Verification status: skipped");
    expect(stdout.text).toContain("Freshness: fresh");
  });
});

class MemoryWritable extends Writable {
  text = "";

  override _write(
    chunk: string | Buffer,
    _encoding: BufferEncoding,
    callback: (error?: Error | null) => void,
  ): void {
    this.text += chunk.toString();
    callback();
  }
}

interface TempRepo extends AsyncDisposable {
  readonly path: string;
}

interface ResultEnvOptions {
  readonly snapshot: Awaited<ReturnType<typeof getCurrentGitSnapshot>>;
  readonly status: TestResultStatus;
  readonly exitCode: number;
}

interface PrepareVerifyScriptOptions {
  readonly staleAfterWrite?: boolean;
}

async function createGitRepo(): Promise<TempRepo> {
  const path = await mkdtemp(join(tmpdir(), "louisgo-"));
  await execFileAsync("git", ["init"], { cwd: path });

  return {
    path,
    async [Symbol.asyncDispose]() {
      await rm(path, { force: true, recursive: true });
    },
  };
}

async function prepareVerifyScript(
  cwd: string,
  options: PrepareVerifyScriptOptions = {},
): Promise<{ readonly snapshot: Awaited<ReturnType<typeof getCurrentGitSnapshot>> }> {
  const paths = createProtocolPaths(cwd);
  await mkdir(paths.scriptsDir, { recursive: true });
  await writeFile(paths.verifySh, createResultScript(options), "utf8");
  const snapshot = await getCurrentGitSnapshot({ cwd });

  return { snapshot };
}

function createResultScript(options: PrepareVerifyScriptOptions): string {
  const staleCommand = options.staleAfterWrite === true ? "printf 'changed\\n' > stale.txt" : "";

  return `#!/usr/bin/env sh
mkdir -p ".louisgo"
cat > ".louisgo/test-results.json" <<JSON
{
  "schema": "louisgo-test-results-v1",
  "command": ".louisgo/scripts/verify.sh",
  "exit_code": $LOUISGO_TEST_EXIT_CODE,
  "status": "$LOUISGO_TEST_STATUS",
  "git_head": "$LOUISGO_TEST_GIT_HEAD",
  "diff_hash": "$LOUISGO_TEST_DIFF_HASH",
  "started_at": "${timestamp}",
  "completed_at": "${completedAt}",
  "summary": "$LOUISGO_TEST_STATUS"
}
JSON
${staleCommand}
exit "$LOUISGO_TEST_EXIT_CODE"
`;
}

function createResultEnv(options: ResultEnvOptions): NodeJS.ProcessEnv {
  return {
    LOUISGO_TEST_EXIT_CODE: String(options.exitCode),
    LOUISGO_TEST_STATUS: options.status,
    LOUISGO_TEST_GIT_HEAD: options.snapshot.gitHead,
    LOUISGO_TEST_DIFF_HASH: options.snapshot.diffHash,
  };
}
