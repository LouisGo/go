import { execFile } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import { describe, expect, it } from "vitest";

import { createProtocolPaths } from "../src/protocol/paths.js";
import type { TestResultStatus } from "../src/protocol/schemas.js";
import { initLouisGo } from "../src/services/init-service.js";
import { getCurrentGitSnapshot } from "../src/verify/freshness.js";
import {
  runVerificationScript,
  selectVerificationScript,
  VerifyRunnerError,
  verifyRunnerErrorCodes,
} from "../src/verify/runner.js";

const execFileAsync = promisify(execFile);
const timestamp = "2026-05-01T20:00:00+08:00";
const completedAt = "2026-05-01T20:01:00+08:00";
const now = () => new Date("2026-05-01T12:00:00.000Z");

describe("验证脚本运行器", () => {
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

  it("运行脚本后捕获退出码并检查 test-results.json", async () => {
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

  it("可以运行 init 生成的默认 verify.sh 并得到新鲜结果", async () => {
    await using repo = await createGitRepo();

    await initLouisGo({ cwd: repo.path, now });

    const result = await runVerificationScript({ cwd: repo.path, platform: "darwin" });

    expect(result.exitCode).toBe(0);
    expect(result.freshness).toMatchObject({
      status: "skipped",
      staleReason: null,
    });
  });

  it("脚本缺失时报错", async () => {
    await using repo = await createGitRepo();

    await expect(runVerificationScript({ cwd: repo.path, platform: "darwin" })).rejects.toSatisfy(
      (error: unknown) =>
        error instanceof VerifyRunnerError && error.code === verifyRunnerErrorCodes.scriptMissing,
    );
  });

  it("脚本未生成结果时报错", async () => {
    await using repo = await createGitRepo();
    const paths = createProtocolPaths(repo.path);

    await mkdir(paths.scriptsDir, { recursive: true });
    await writeFile(paths.verifySh, "#!/usr/bin/env sh\nprintf 'no result\\n'\nexit 0\n", "utf8");

    await expect(runVerificationScript({ cwd: repo.path, platform: "darwin" })).rejects.toSatisfy(
      (error: unknown) =>
        error instanceof VerifyRunnerError &&
        error.code === verifyRunnerErrorCodes.resultMissing &&
        error.exitCode === 0 &&
        error.stdout?.includes("no result") === true,
    );
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
