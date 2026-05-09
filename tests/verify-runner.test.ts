import { execFile } from "node:child_process";
import { access, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import { describe, expect, it } from "vitest";

import { createProtocolPaths } from "../src/protocol/paths.js";
import type { TestResultStatus } from "../src/protocol/schemas.js";
import { initLouisGo } from "../src/services/init-service.js";
import { getCurrentGitSnapshot } from "../src/verify/freshness.js";
import { runVerificationScript, selectVerificationScript } from "../src/verify/runner.js";

const execFileAsync = promisify(execFile);
const timestamp = "2026-05-01T20:00:00+08:00";
const completedAt = "2026-05-01T20:01:00+08:00";
const now = () => new Date("2026-05-01T12:00:00.000Z");

describe("verification runner", () => {
  it("macOS / Linux 默认选择 verify.sh", () => {
    const paths = createProtocolPaths("/tmp/louisgo-runner");

    expect(selectVerificationScript(paths, "darwin")).toMatchObject({
      kind: "sh",
      filePath: paths.verifySh,
      relativePath: ".louisgo/scripts/verify.sh",
      command: "sh",
      args: [paths.verifySh],
    });
    expect(selectVerificationScript(paths, "linux")).toMatchObject({
      kind: "sh",
      filePath: paths.verifySh,
    });
  });

  it("Windows 默认选择 verify.ps1", () => {
    const paths = createProtocolPaths("/tmp/louisgo-runner");

    expect(selectVerificationScript(paths, "win32")).toMatchObject({
      kind: "ps1",
      filePath: paths.verifyPs1,
      relativePath: ".louisgo/scripts/verify.ps1",
      command: "powershell.exe",
    });
  });

  it("运行脚本后兼容读取 test-results.json", async () => {
    await using repo = await createGitRepo();
    const paths = createProtocolPaths(repo.path);

    await mkdir(paths.scriptsDir, { recursive: true });
    await writeFile(paths.verifySh, createResultScript(), "utf8");
    const snapshot = await getCurrentGitSnapshot({ cwd: repo.path });

    const result = await runVerificationScript({
      cwd: repo.path,
      platform: "darwin",
      env: createResultEnv({ snapshot, status: "failed", exitCode: 7 }),
    });

    expect(result.script.relativePath).toBe(".louisgo/scripts/verify.sh");
    expect(result.exitCode).toBe(7);
    expect(result.stdout).toContain("runner stdout");
    expect(result.stderr).toContain("runner stderr");
    expect(result.freshness).toMatchObject({
      status: "failed",
      staleReason: null,
      currentSnapshot: snapshot,
    });
  });

  it("没有项目脚本时使用全局 verify 生成 skipped 结果", async () => {
    await using repo = await createGitRepo();
    const paths = createProtocolPaths(repo.path);

    await initLouisGo({ cwd: repo.path, now });

    const result = await runVerificationScript({ cwd: repo.path, platform: "darwin" });

    expect(result.script).toMatchObject({
      kind: "global",
      relativePath: "louisgo verify",
      command: "louisgo",
    });
    expect(result.exitCode).toBe(0);
    expect(result.freshness).toMatchObject({
      status: "skipped",
      staleReason: null,
    });
    await expect(access(paths.testResults)).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("未初始化项目脚本时也使用全局 verify 写入 skipped 结果", async () => {
    await using repo = await createGitRepo();

    const result = await runVerificationScript({ cwd: repo.path, platform: "darwin" });

    expect(result.script.kind).toBe("global");
    expect(result.freshness.status).toBe("skipped");
  });

  it("脚本未生成结构化结果时按退出码合成结果", async () => {
    await using repo = await createGitRepo();
    const paths = createProtocolPaths(repo.path);

    await mkdir(paths.scriptsDir, { recursive: true });
    await writeFile(paths.verifySh, "#!/usr/bin/env sh\nprintf 'no result\\n'\nexit 0\n", "utf8");

    const result = await runVerificationScript({ cwd: repo.path, platform: "darwin" });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("no result");
    expect(result.freshness.testResults).toMatchObject({
      status: "passed",
      summary: "no result",
    });
    await expect(access(paths.testResults)).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("脚本未更新兼容结果文件时忽略旧 test-results.json", async () => {
    await using repo = await createGitRepo();
    const paths = createProtocolPaths(repo.path);

    await mkdir(paths.scriptsDir, { recursive: true });
    await mkdir(paths.louisgoDir, { recursive: true });
    await writeFile(
      paths.verifySh,
      "#!/usr/bin/env sh\nprintf 'fresh stdout\\n'\nexit 0\n",
      "utf8",
    );
    await writeFile(
      paths.testResults,
      `${JSON.stringify({
        schema: "louisgo-test-results-v1",
        command: "old",
        exit_code: 1,
        status: "failed",
        git_head: "old-head",
        diff_hash: "old-diff",
        started_at: timestamp,
        completed_at: completedAt,
        summary: "old result",
      })}\n`,
      "utf8",
    );

    const result = await runVerificationScript({ cwd: repo.path, platform: "darwin" });

    expect(result.freshness.testResults).toMatchObject({
      command: ".louisgo/scripts/verify.sh",
      status: "passed",
      summary: "fresh stdout",
    });
  });
});

interface TempRepo extends AsyncDisposable {
  readonly path: string;
}

interface ResultEnvOptions {
  readonly snapshot: Awaited<ReturnType<typeof getCurrentGitSnapshot>>;
  readonly status: TestResultStatus;
  readonly exitCode: number;
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

function createResultScript(): string {
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
printf 'runner stdout\\n'
printf 'runner stderr\\n' >&2
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
