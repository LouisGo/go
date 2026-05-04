import { execFile } from "node:child_process";
import { access, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import { describe, expect, it } from "vitest";

import { workspaceErrorCodes } from "../src/fs/workspace.js";
import { readFrontMatter } from "../src/protocol/frontmatter.js";
import { createProtocolPaths } from "../src/protocol/paths.js";
import { parseRoadmap } from "../src/protocol/roadmap.js";
import {
  capabilitiesFrontMatterSchema,
  memoryFrontMatterSchema,
  missionFrontMatterSchema,
  stateFrontMatterSchema,
} from "../src/protocol/schemas.js";
import { initLouisGo } from "../src/services/init-service.js";

const execFileAsync = promisify(execFile);
const now = () => new Date("2026-05-01T12:00:00.000Z");

describe("init 服务", () => {
  it("在 Git 仓库中首次 init 成功", async () => {
    await using tempDir = await createTempDir();
    await execFileAsync("git", ["init"], { cwd: tempDir.path });

    const result = await initLouisGo({ cwd: tempDir.path, now });
    const paths = createProtocolPaths(result.workspaceRoot);

    await expect(access(paths.louisgoDir)).resolves.toBeUndefined();
    await expect(access(paths.scriptsDir)).resolves.toBeUndefined();
    await expect(access(paths.adrDraftDir)).resolves.toBeUndefined();
    await expect(access(paths.memoryDir)).resolves.toBeUndefined();
    await expect(access(paths.sessionsDir)).resolves.toBeUndefined();
    await expect(access(paths.skillsDir)).resolves.toBeUndefined();
    await expect(access(paths.mission)).resolves.toBeUndefined();
    await expect(access(paths.roadmap)).resolves.toBeUndefined();
    await expect(access(paths.state)).resolves.toBeUndefined();
    await expect(access(paths.memory)).resolves.toBeUndefined();
    await expect(access(paths.blocker)).resolves.toBeUndefined();
    await expect(access(paths.gitignore)).resolves.toBeUndefined();
    await expect(access(paths.runLog)).resolves.toBeUndefined();
    await expect(access(paths.capabilities)).resolves.toBeUndefined();
    await expect(access(paths.verifySh)).resolves.toBeUndefined();
    await expect(access(paths.verifyPs1)).resolves.toBeUndefined();
    await expect(access(join(paths.skillsDir, "grill.md"))).resolves.toBeUndefined();
    await expect(access(join(paths.skillsDir, "caveman.md"))).resolves.toBeUndefined();
    await expect(access(join(paths.skillsDir, "diagnose.md"))).rejects.toMatchObject({ code: "ENOENT" });
    await expect(access(join(paths.skillsDir, "zoom-out.md"))).rejects.toMatchObject({ code: "ENOENT" });

    const mission = await readFrontMatter(paths.mission, missionFrontMatterSchema);
    const capabilities = await readFrontMatter(paths.capabilities, capabilitiesFrontMatterSchema);
    const state = await readFrontMatter(paths.state, stateFrontMatterSchema);
    const memory = await readFrontMatter(paths.memory, memoryFrontMatterSchema);
    const roadmap = parseRoadmap(await readFile(paths.roadmap, "utf8"));
    const runLog = await readFile(paths.runLog, "utf8");
    const verifyShStat = await stat(paths.verifySh);

    expect(mission.frontMatter.defaultMode).toBe("assist");
    expect(capabilities.body).toContain(".louisgo/scripts/verify.sh");
    expect(state.frontMatter.currentTask).toBe("T001");
    expect(memory.body).toContain("HANDOFF.md");
    expect(roadmap.firstIncompleteTask?.id).toBe("T001");
    expect(runLog).toContain("schema: louisgo-runlog-v1");
    await expect(readFile(paths.gitignore, "utf8")).resolves.toContain("RUNLOG.md");
    expect(verifyShStat.mode & 0o111).toBeGreaterThan(0);
    expect(result.files.every((file) => file.status === "created")).toBe(true);
    expect(result.nextSteps).toContain("需要深度重建时输入 $start");
  });

  it("重复 init 不覆盖用户文件", async () => {
    await using tempDir = await createTempDir();
    await execFileAsync("git", ["init"], { cwd: tempDir.path });

    const firstResult = await initLouisGo({ cwd: tempDir.path, now });
    const paths = createProtocolPaths(firstResult.workspaceRoot);
    await writeFile(paths.mission, "用户自定义内容\n", "utf8");

    const result = await initLouisGo({ cwd: tempDir.path, now });

    await expect(readFile(paths.mission, "utf8")).resolves.toBe("用户自定义内容\n");
    expect(
      result.files.some((file) => file.filePath === paths.mission && file.status === "skipped"),
    ).toBe(true);
  });

  it("非 Git 仓库中 init 失败并提示先执行 git init", async () => {
    await using tempDir = await createTempDir();

    await expect(initLouisGo({ cwd: tempDir.path, now })).rejects.toMatchObject({
      code: workspaceErrorCodes.notGitRepository,
      message: expect.stringContaining("请先执行 git init"),
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
