import { execFile } from "node:child_process";
import { access, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { beforeAll, describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);
const projectRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const cliPath = join(projectRoot, "dist", "cli.js");
const timestamp = "2026-05-01T20:00:00+08:00";

describe("CLI 端到端工作流", () => {
  beforeAll(async () => {
    await execFileAsync("pnpm", ["build"], { cwd: projectRoot });
  }, 120_000);

  it("macOS / Linux 主流程可以从 init 跑到 finish", async () => {
    await using repo = await createGitRepo();

    const init = await runCli(repo.path, ["init"]);
    expect(init.stdout).toContain("LouisGo initialized");
    expect(init.stdout).toContain("Files created: 3");
    expect(init.stdout).toContain("Codex integration: completed");
    expect(init.stdout).toContain("→ Private task state will be stored outside team Git");

    const initialStatus = await runCli(repo.path, ["status"]);
    expect(initialStatus.stdout).toContain("[assist/idle] complete, current task none");
    expect(initialStatus.stdout).toContain("verification status missing");
    expect(initialStatus.stdout).toContain("recovery source none");

    const context = await runCli(repo.path, ["context", "--goal", "E2E 外部项目实验"]);
    expect(context.stdout).toContain("# LouisGo Context Package");
    expect(context.stdout).toContain("Goal: E2E 外部项目实验");
    expect(context.stdout).toContain("Cold Start");
    expect(context.stdout).not.toContain("Source: `.louisgo/MISSION.md`");

    const verify = await runCli(repo.path, ["verify"], { allowedExitCodes: [1] });
    expect(verify.stdout).toContain("Verification entry: louisgo verify");
    expect(verify.stdout).toContain("Verification status: skipped");
    expect(verify.stdout).toContain("Freshness: fresh");
    expect(verify.stdout).toContain(
      "Result: verification did not pass or cannot represent the current code state",
    );

    const verifiedStatus = await runCli(repo.path, ["status"]);
    expect(verifiedStatus.stdout).toContain("verification status skipped");

    const pause = await runCli(repo.path, ["pause"]);
    expect(pause.stdout).toContain("LouisGo private checkpoint updated");

    const pausedStatus = await runCli(repo.path, ["status"]);
    expect(pausedStatus.stdout).toContain("recovery source PRIVATE_TASK");

    const finish = await runCli(repo.path, ["finish"]);
    expect(finish.stdout).toContain("LouisGo private finish updated");
    expect(finish.stdout).toContain("Verification status: skipped");

    const finalStatus = await runCli(repo.path, ["status"]);
    expect(finalStatus.stdout).toContain("verification status skipped");
    expect(finalStatus.stdout).toContain("recovery source PRIVATE_TASK");

    const log = await runCli(repo.path, ["log", "--tail", "5"]);
    expect(log.stdout).toContain("# Run Log");
    expect(log.stdout).toContain("finish");
  }, 20_000);

  it("未解决确认请求和 ADR 草稿能在 status / finish 中体现", async () => {
    await using repo = await createGitRepo();

    await runCli(repo.path, ["init"]);
    await writeConfirmReq(repo.path);
    await writeAdrDraft(repo.path);

    const status = await runCli(repo.path, ["status"]);
    expect(status.stdout).toContain("Open confirmation request");
    expect(status.stdout).toContain("ADR drafts present: 1");

    const finish = await runCli(repo.path, ["finish"]);
    expect(finish.stdout).toContain("LouisGo private finish updated");
    await expect(access(join(repo.path, ".louisgo", "CONFIRM_REQ.md"))).resolves.toBeUndefined();
  });
});

interface CliResult {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
}

interface RunCliOptions {
  readonly allowedExitCodes?: readonly number[];
}

interface TempRepo extends AsyncDisposable {
  readonly path: string;
  readonly louisgoHome: string;
}

async function createGitRepo(): Promise<TempRepo> {
  const path = await mkdtemp(join(tmpdir(), "louisgo-e2e-"));
  const louisgoHome = join(tmpdir(), `${basename(path)}-home`);
  await execFileAsync("git", ["init"], { cwd: path });

  return {
    path,
    louisgoHome,
    async [Symbol.asyncDispose]() {
      await rm(path, { force: true, recursive: true });
      await rm(louisgoHome, { force: true, recursive: true });
    },
  };
}

async function runCli(
  cwd: string,
  args: readonly string[],
  options: RunCliOptions = {},
): Promise<CliResult> {
  const allowedExitCodes = options.allowedExitCodes ?? [0];

  try {
    const result = await execFileAsync(process.execPath, [cliPath, ...args], {
      cwd,
      encoding: "utf8",
      env: {
        ...process.env,
        CODEX_HOME: join(tmpdir(), "louisgo-e2e-codex-home"),
        LOUISGO_HOME: join(tmpdir(), `${basename(cwd)}-home`),
      },
    });

    return {
      exitCode: 0,
      stdout: result.stdout,
      stderr: result.stderr,
    };
  } catch (error) {
    if (!isExecError(error) || typeof error.code !== "number") {
      throw error;
    }

    if (!allowedExitCodes.includes(error.code)) {
      throw error;
    }

    return {
      exitCode: error.code,
      stdout: typeof error.stdout === "string" ? error.stdout : "",
      stderr: typeof error.stderr === "string" ? error.stderr : "",
    };
  }
}

async function writeConfirmReq(cwd: string): Promise<void> {
  const filePath = join(cwd, ".louisgo", "CONFIRM_REQ.md");
  await writeFile(
    filePath,
    `---
schema: louisgo-confirm-req-v1
mode: assist
task_id: T001
status: open
created_at: "${timestamp}"
---

# Confirm Request

## 背景

E2E 测试中的确认请求。

## Options

- A. 继续主流程
- B. 停止

## 建议
`,
    "utf8",
  );
}

async function writeAdrDraft(cwd: string): Promise<void> {
  const draftDir = join(cwd, ".louisgo", "ADR", "draft");
  await mkdir(draftDir, { recursive: true });
  await writeFile(
    join(draftDir, "001-e2e.md"),
    `---
schema: louisgo-adr-v1
status: draft
adr_id: null
created_at: "${timestamp}"
confirmed_at: null
---

# ADR Draft: E2E

## 背景

## Decision

## 影响

## Alternatives
`,
    "utf8",
  );
}

function isExecError(error: unknown): error is NodeJS.ErrnoException & {
  readonly stdout?: unknown;
  readonly stderr?: unknown;
} {
  return error instanceof Error && "code" in error;
}
