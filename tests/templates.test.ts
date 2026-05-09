import { execFile } from "node:child_process";
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { promisify } from "node:util";

import { describe, expect, it } from "vitest";

import { readFrontMatter } from "../src/protocol/frontmatter.js";
import {
  adrFrontMatterSchema,
  capabilitiesFrontMatterSchema,
  confirmReqFrontMatterSchema,
  missionFrontMatterSchema,
  runLogFrontMatterSchema,
  testResultsSchema,
} from "../src/protocol/schemas.js";
import { createAdrDraftTemplate } from "../src/templates/adr-draft.js";
import { createCapabilitiesTemplate } from "../src/templates/capabilities.js";
import { createConfirmReqTemplate } from "../src/templates/confirm-req.js";
import { createMissionTemplate } from "../src/templates/mission.js";
import { createLouisGoGitignoreTemplate, createRunLogTemplate } from "../src/templates/run-log.js";
import { createVerifyPs1Template } from "../src/templates/verify-ps1.js";
import { createVerifyShTemplate } from "../src/templates/verify-sh.js";
import { checkVerificationFreshness } from "../src/verify/freshness.js";

const execFileAsync = promisify(execFile);
const timestamp = "2026-05-01T20:00:00+08:00";

describe("协议模板", () => {
  it("生成 MISSION.md 必要 Front Matter", async () => {
    await using tempDir = await createTempDir();
    const filePath = join(tempDir.path, "MISSION.md");

    await writeFile(filePath, createMissionTemplate({ updatedAt: timestamp }), "utf8");

    const document = await readFrontMatter(filePath, missionFrontMatterSchema);
    expect(document.frontMatter).toEqual({
      schema: "louisgo-mission-v1",
      defaultMode: "assist",
      updatedAt: timestamp,
    });
    expect(document.body).toContain("## Decision Records");
  });

  it("生成 RUNLOG.md 诊断日志模板", async () => {
    await using tempDir = await createTempDir();
    const filePath = join(tempDir.path, "RUNLOG.md");

    await writeFile(filePath, createRunLogTemplate({ updatedAt: timestamp }), "utf8");

    const document = await readFrontMatter(filePath, runLogFrontMatterSchema);
    expect(document.frontMatter).toMatchObject({
      schema: "louisgo-runlog-v1",
      updatedAt: timestamp,
      maxEvents: 80,
    });
    expect(document.body).toContain("louisgo-runlog:events");
    expect(createLouisGoGitignoreTemplate()).toContain("CONFIRM_REQ.md");
    expect(createLouisGoGitignoreTemplate()).not.toContain("RUNLOG.md");
    expect(createLouisGoGitignoreTemplate()).not.toContain("stats/");
  });

  it("生成 CAPABILITIES.md 必要 Front Matter 和验证入口", async () => {
    await using tempDir = await createTempDir();
    const filePath = join(tempDir.path, "CAPABILITIES.md");

    await writeFile(filePath, createCapabilitiesTemplate({ updatedAt: timestamp }), "utf8");

    const document = await readFrontMatter(filePath, capabilitiesFrontMatterSchema);
    expect(document.frontMatter).toEqual({
      schema: "louisgo-capabilities-v1",
      updatedAt: timestamp,
    });
    expect(document.body).toContain("louisgo verify");
    expect(document.body).toContain("Default init does not copy verify scripts");
    expect(document.body).toContain("verification facts are attached to the active private task");
    expect(document.body).toContain("louisgo stats");
    expect(document.body).toContain("louisgo stats import codex");
    expect(document.body).toContain("louisgo skill list");
    expect(document.body).toContain("louisgo skill enable grill");
    expect(document.body).toContain("louisgo clear");
    expect(document.body).toContain("## ADR Guidance");
    expect(document.body).toContain("hard to reverse");
    expect(document.body).toContain("## Optional Skills");
    expect(document.body).toContain("not installed by default");
    expect(document.body).toContain("does not overwrite");
    expect(document.body).toContain("grill");
    expect(document.body).toContain("caveman");
    expect(document.body).not.toContain("diagnose");
    expect(document.body).not.toContain("zoom-out");
  });

  it("生成 CONFIRM_REQ.md 必要 Front Matter", async () => {
    await using tempDir = await createTempDir();
    const filePath = join(tempDir.path, "CONFIRM_REQ.md");

    await writeFile(
      filePath,
      createConfirmReqTemplate({
        mode: "assist",
        taskId: "T001",
        createdAt: timestamp,
      }),
      "utf8",
    );

    const document = await readFrontMatter(filePath, confirmReqFrontMatterSchema);
    expect(document.frontMatter).toEqual({
      schema: "louisgo-confirm-req-v1",
      mode: "assist",
      taskId: "T001",
      status: "open",
      createdAt: timestamp,
    });
    expect(document.body).toContain("## Options");
  });

  it("生成 ADR 草稿模板并满足最小门禁结构", async () => {
    await using tempDir = await createTempDir();
    const filePath = join(tempDir.path, "ADR-draft.md");

    await writeFile(filePath, createAdrDraftTemplate({ createdAt: timestamp }), "utf8");

    const document = await readFrontMatter(filePath, adrFrontMatterSchema);
    expect(document.frontMatter).toEqual({
      schema: "louisgo-adr-v1",
      status: "draft",
      adrId: null,
      createdAt: timestamp,
      confirmedAt: null,
    });
    expect(document.body).toContain("## Decision");
    expect(document.body).toContain("hard to reverse");
    expect(document.body).not.toContain("## Alternatives");
  });

  it("verify.sh 模板可以生成最小 test-results.json", async () => {
    await using tempDir = await createTempDir();
    const scriptPath = join(tempDir.path, ".louisgo", "scripts", "verify.sh");
    const resultPath = join(tempDir.path, ".louisgo", "test-results.json");
    const trackedPath = join(tempDir.path, "tracked.txt");

    await execFileAsync("git", ["init"], { cwd: tempDir.path });
    await writeFile(trackedPath, "one\n", "utf8");
    await execFileAsync("git", ["add", "tracked.txt"], { cwd: tempDir.path });
    await execFileAsync(
      "git",
      ["-c", "user.email=a@example.com", "-c", "user.name=a", "commit", "-m", "init"],
      { cwd: tempDir.path },
    );
    await mkdirForFile(scriptPath);
    await writeFile(scriptPath, createVerifyShTemplate(), "utf8");
    await chmod(scriptPath, 0o755);
    await writeFile(trackedPath, "two\n", "utf8");
    await execFileAsync("sh", [scriptPath], { cwd: tempDir.path });

    const result = testResultsSchema.parse(JSON.parse(await readFile(resultPath, "utf8")));

    expect(result).toMatchObject({
      schema: "louisgo-test-results-v1",
      command: ".louisgo/scripts/verify.sh",
      exitCode: 0,
      status: "skipped",
      summary: "No project verification command configured; skipped",
    });
    expect(result.gitHead.length).toBeGreaterThan(0);
    expect(result.diffHash).toMatch(/^[a-f0-9]{64}$/);
    await expect(
      checkVerificationFreshness({
        cwd: tempDir.path,
        testResultsPath: resultPath,
      }),
    ).resolves.toMatchObject({
      status: "skipped",
      staleReason: null,
    });

    await writeFile(trackedPath, "three\n", "utf8");
    await execFileAsync("sh", [scriptPath], { cwd: tempDir.path });

    const nextResult = testResultsSchema.parse(JSON.parse(await readFile(resultPath, "utf8")));
    expect(nextResult.diffHash).not.toBe(result.diffHash);
  });

  it("verify.ps1 模板包含 test-results.json 最小字段", async () => {
    const template = createVerifyPs1Template();

    expect(template).toContain('schema = "louisgo-test-results-v1"');
    expect(template).toContain("git_head = $GitHead");
    expect(template).toContain("diff_hash = $DiffHash");
    expect(template).toContain("status = $Status");
    expect(template).toContain(".louisgo/test-results.json");

    if (!(await hasPwsh())) {
      return;
    }

    await using tempDir = await createTempDir();
    const scriptPath = join(tempDir.path, ".louisgo", "scripts", "verify.ps1");
    const resultPath = join(tempDir.path, ".louisgo", "test-results.json");

    await execFileAsync("git", ["init"], { cwd: tempDir.path });
    await mkdirForFile(scriptPath);
    await writeFile(scriptPath, template, "utf8");
    await execFileAsync("pwsh", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", scriptPath], {
      cwd: tempDir.path,
    });

    const result = testResultsSchema.parse(JSON.parse(await readFile(resultPath, "utf8")));
    expect(result).toMatchObject({
      schema: "louisgo-test-results-v1",
      command: ".louisgo/scripts/verify.ps1",
      exitCode: 0,
      status: "skipped",
      summary: "No project verification command configured; skipped",
    });
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

async function mkdirForFile(filePath: string): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
}

async function hasPwsh(): Promise<boolean> {
  try {
    await execFileAsync("pwsh", ["-NoProfile", "-Command", "$PSVersionTable.PSVersion.ToString()"]);
    return true;
  } catch {
    return false;
  }
}
