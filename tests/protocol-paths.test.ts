import { execFile } from "node:child_process";
import { mkdtemp, mkdir, realpath, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { promisify } from "node:util";

import { describe, expect, it } from "vitest";

import { findGitRoot, workspaceErrorCodes } from "../src/fs/workspace.js";
import { createProtocolPaths, protocolRelativePaths } from "../src/protocol/paths.js";

const execFileAsync = promisify(execFile);

describe("协议路径", () => {
  it("可以在 Git 仓库内定位根目录并生成 MVP 协议绝对路径", async () => {
    await using tempDir = await createTempDir();
    const repoRoot = join(tempDir.path, "repo");
    const nestedDir = join(repoRoot, "packages", "demo");

    await mkdir(nestedDir, { recursive: true });
    await execFileAsync("git", ["init"], { cwd: repoRoot });

    const resolvedRoot = await findGitRoot(nestedDir);
    const expectedRoot = await realpath(repoRoot);
    const paths = createProtocolPaths(resolvedRoot);

    expect(resolvedRoot).toBe(expectedRoot);
    expect(paths).toEqual({
      workspaceRoot: expectedRoot,
      louisgoDir: join(expectedRoot, ".louisgo"),
      mission: join(expectedRoot, ".louisgo", "MISSION.md"),
      roadmap: join(expectedRoot, ".louisgo", "ROADMAP.md"),
      state: join(expectedRoot, ".louisgo", "STATE.md"),
      memory: join(expectedRoot, ".louisgo", "MEMORY.md"),
      handoff: join(expectedRoot, ".louisgo", "HANDOFF.md"),
      handoffDraft: join(expectedRoot, ".louisgo", "HANDOFF_DRAFT.md"),
      quickSave: join(expectedRoot, ".louisgo", "QUICK_SAVE.md"),
      blocker: join(expectedRoot, ".louisgo", "BLOCKER.md"),
      confirmReq: join(expectedRoot, ".louisgo", "CONFIRM_REQ.md"),
      runLog: join(expectedRoot, ".louisgo", "RUNLOG.md"),
      capabilities: join(expectedRoot, ".louisgo", "CAPABILITIES.md"),
      context: join(expectedRoot, ".louisgo", "CONTEXT.md"),
      testResults: join(expectedRoot, ".louisgo", "test-results.json"),
      gitignore: join(expectedRoot, ".louisgo", ".gitignore"),
      adrDir: join(expectedRoot, ".louisgo", "ADR"),
      adrDraftDir: join(expectedRoot, ".louisgo", "ADR", "draft"),
      memoryDir: join(expectedRoot, ".louisgo", "memory"),
      sessionsDir: join(expectedRoot, ".louisgo", "sessions"),
      statsDir: join(expectedRoot, ".louisgo", "stats"),
      statsEvents: join(expectedRoot, ".louisgo", "stats", "events.jsonl"),
      statsImports: join(expectedRoot, ".louisgo", "stats", "imports.json"),
      scriptsDir: join(expectedRoot, ".louisgo", "scripts"),
      skillsDir: join(expectedRoot, ".louisgo", "skills"),
      verifySh: join(expectedRoot, ".louisgo", "scripts", "verify.sh"),
      verifyPs1: join(expectedRoot, ".louisgo", "scripts", "verify.ps1"),
    });
  });

  it("协议相对路径使用 POSIX 风格", () => {
    expect(protocolRelativePaths.verifySh).toBe(".louisgo/scripts/verify.sh");
    expect(protocolRelativePaths.verifyPs1).toBe(".louisgo/scripts/verify.ps1");
    expect(protocolRelativePaths.adrDraftDir).toBe(".louisgo/ADR/draft");
    expect(protocolRelativePaths.state).toBe(".louisgo/STATE.md");
    expect(protocolRelativePaths.memoryDir).toBe(".louisgo/memory");
    expect(protocolRelativePaths.skillsDir).toBe(".louisgo/skills");
    expect(protocolRelativePaths.runLog).toBe(".louisgo/RUNLOG.md");
    expect(protocolRelativePaths.context).toBe(".louisgo/CONTEXT.md");
    expect(protocolRelativePaths.statsEvents).toBe(".louisgo/stats/events.jsonl");
  });

  it("非 Git 仓库返回明确错误", async () => {
    await using tempDir = await createTempDir();

    await expect(findGitRoot(tempDir.path)).rejects.toMatchObject({
      code: workspaceErrorCodes.notGitRepository,
      cwd: tempDir.path,
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
