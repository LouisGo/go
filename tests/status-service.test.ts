import { execFile } from "node:child_process";
import { mkdtemp, rm, unlink, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import { describe, expect, it } from "vitest";

import { createProtocolPaths } from "../src/protocol/paths.js";
import { protocolIssueCodes } from "../src/services/status-service.js";
import { initLouisGo } from "../src/services/init-service.js";
import { checkProtocolStatus } from "../src/services/status-service.js";
import { createAdrDraftTemplate } from "../src/templates/adr-draft.js";
import { createConfirmReqTemplate } from "../src/templates/confirm-req.js";

const execFileAsync = promisify(execFile);
const now = () => new Date("2026-05-01T12:00:00.000Z");
const timestamp = "2026-05-01T20:00:00+08:00";

describe("协议完整性检查", () => {
  it("识别完整协议目录、当前模式和当前任务", async () => {
    await using repo = await createGitRepo();
    const initResult = await initLouisGo({ cwd: repo.path, now });

    const status = await checkProtocolStatus({ cwd: repo.path });

    expect(status).toMatchObject({
      workspaceRoot: initResult.workspaceRoot,
      complete: true,
      mode: "assist",
      recoverySource: "none",
      verificationStatus: "missing",
      hasConfirmReq: false,
      adrDrafts: [],
      issues: [],
    });
    expect(status.currentTask).toMatchObject({
      id: "T001",
      completed: false,
    });
  });

  it("报告缺失文件", async () => {
    await using repo = await createGitRepo();
    const initResult = await initLouisGo({ cwd: repo.path, now });
    const paths = createProtocolPaths(initResult.workspaceRoot);

    await unlink(paths.mission);

    const status = await checkProtocolStatus({ cwd: repo.path });

    expect(status.complete).toBe(false);
    expect(status.issues).toContainEqual(
      expect.objectContaining({
        code: protocolIssueCodes.missingPath,
        filePath: paths.mission,
        relativePath: ".louisgo/MISSION.md",
      }),
    );
  });

  it("报告 Front Matter 错误", async () => {
    await using repo = await createGitRepo();
    const initResult = await initLouisGo({ cwd: repo.path, now });
    const paths = createProtocolPaths(initResult.workspaceRoot);

    await writeFile(
      paths.mission,
      `---
schema: louisgo-mission-v1
---

# Mission
`,
      "utf8",
    );

    const status = await checkProtocolStatus({ cwd: repo.path });

    expect(status.complete).toBe(false);
    expect(status.mode).toBeNull();
    expect(status.issues).toContainEqual(
      expect.objectContaining({
        code: protocolIssueCodes.frontMatterInvalid,
        filePath: paths.mission,
      }),
    );
  });

  it("识别 QUICK_SAVE 比 HANDOFF 更新", async () => {
    await using repo = await createGitRepo();
    const initResult = await initLouisGo({ cwd: repo.path, now });
    const paths = createProtocolPaths(initResult.workspaceRoot);

    await writeFile(paths.handoff, createHandoff("2026-05-01T20:00:00Z"), "utf8");
    await writeFile(paths.quickSave, createQuickSave("2026-05-01T20:05:00Z"), "utf8");
    await utimes(paths.handoff, new Date("2026-05-01T20:00:00Z"), new Date("2026-05-01T20:00:00Z"));
    await utimes(
      paths.quickSave,
      new Date("2026-05-01T20:05:00Z"),
      new Date("2026-05-01T20:05:00Z"),
    );

    const status = await checkProtocolStatus({ cwd: repo.path });

    expect(status.complete).toBe(true);
    expect(status.recoverySource).toBe("quick_save");
  });

  it("识别未解决 CONFIRM_REQ", async () => {
    await using repo = await createGitRepo();
    const initResult = await initLouisGo({ cwd: repo.path, now });
    const paths = createProtocolPaths(initResult.workspaceRoot);

    await writeFile(
      paths.confirmReq,
      createConfirmReqTemplate({
        mode: "assist",
        taskId: "T001",
        createdAt: timestamp,
      }),
      "utf8",
    );

    const status = await checkProtocolStatus({ cwd: repo.path });

    expect(status.complete).toBe(true);
    expect(status.hasConfirmReq).toBe(true);
  });

  it("识别 ADR 草稿", async () => {
    await using repo = await createGitRepo();
    const initResult = await initLouisGo({ cwd: repo.path, now });
    const paths = createProtocolPaths(initResult.workspaceRoot);

    await writeFile(
      join(paths.adrDraftDir, "001-api.md"),
      createAdrDraftTemplate({ createdAt: timestamp, title: "API" }),
      "utf8",
    );

    const status = await checkProtocolStatus({ cwd: repo.path });

    expect(status.complete).toBe(true);
    expect(status.adrDrafts).toEqual(["001-api.md"]);
  });
});

interface TempRepo extends AsyncDisposable {
  readonly path: string;
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

function createQuickSave(savedAt: string): string {
  return `---
schema: louisgo-quick-save-v1
mode: assist
task_id: T001
git_head: NO_HEAD
diff_hash: abc123
saved_at: "${savedAt}"
---

# Quick Save
`;
}

function createHandoff(generatedAt: string): string {
  return `---
schema: louisgo-handoff-v1
mode: assist
task_id: T001
git_head: NO_HEAD
diff_hash: abc123
verification: missing
generated_at: "${generatedAt}"
---

# Handoff
`;
}
