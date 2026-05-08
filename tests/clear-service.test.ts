import { execFile } from "node:child_process";
import { access, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import { describe, expect, it } from "vitest";

import { clearLouisGo, clearTargetStatuses } from "../src/services/clear-service.js";
import { setupCodex } from "../src/services/codex-service.js";
import { initLouisGo } from "../src/services/init-service.js";

const execFileAsync = promisify(execFile);
const now = () => new Date("2026-05-01T12:00:00.000Z");

describe("clear service", () => {
  it("dry-run 只预览目标，不删除文件", async () => {
    await using repo = await createInitializedRepo();
    await using codex = await createTempDir();
    await setupCodex({ cwd: repo.path, codexHome: codex.path });

    const result = await clearLouisGo({ cwd: repo.path, dryRun: true });

    expect(result.dryRun).toBe(true);
    expect(result.targets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          relativePath: ".louisgo",
          status: clearTargetStatuses.planned,
        }),
        expect.objectContaining({
          relativePath: "AGENTS.md",
          status: clearTargetStatuses.planned,
        }),
      ]),
    );
    await expect(access(join(repo.path, ".louisgo"))).resolves.toBeUndefined();
    await expect(readFile(join(repo.path, "AGENTS.md"), "utf8")).resolves.toContain(
      "louisgo-codex:start",
    );
  });

  it("清理 .louisgo 并移除 AGENTS.md 中 LouisGo 管理块", async () => {
    await using repo = await createInitializedRepo();
    await using codex = await createTempDir();
    const agentsPath = join(repo.path, "AGENTS.md");

    await writeFile(
      agentsPath,
      `# Existing

保留内容。

<!-- louisgo-codex:start -->
旧内容
<!-- louisgo-codex:end -->
`,
      "utf8",
    );
    await setupCodex({ cwd: repo.path, codexHome: codex.path });
    await mkdir(join(repo.path, ".louisgo", "stats"), { recursive: true });
    await writeFile(join(repo.path, ".louisgo", "stats", "events.jsonl"), "{}\n", "utf8");

    const result = await clearLouisGo({
      cwd: repo.path,
    });

    expect(result.targets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          relativePath: ".louisgo",
          status: clearTargetStatuses.deleted,
        }),
        expect.objectContaining({
          relativePath: "AGENTS.md",
          status: clearTargetStatuses.updated,
        }),
      ]),
    );
    await expect(access(join(repo.path, ".louisgo"))).rejects.toMatchObject({
      code: "ENOENT",
    });
    await expect(readFile(agentsPath, "utf8")).resolves.toBe("# Existing\n\n保留内容。\n");
  });

  it("AGENTS.md 只包含 LouisGo 管理块时删除该文件", async () => {
    await using repo = await createInitializedRepo();
    await using codex = await createTempDir();
    const agentsPath = join(repo.path, "AGENTS.md");

    await setupCodex({ cwd: repo.path, codexHome: codex.path });

    const result = await clearLouisGo({
      cwd: repo.path,
    });

    expect(result.targets).toContainEqual(
      expect.objectContaining({
        relativePath: "AGENTS.md",
        status: clearTargetStatuses.deleted,
      }),
    );
    await expect(access(agentsPath)).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("项目复用 Agent.md 时清理该文件中的 LouisGo 管理块", async () => {
    await using repo = await createInitializedRepo();
    await using codex = await createTempDir();
    const agentPath = join(repo.path, "Agent.md");

    await writeFile(agentPath, "# Existing Agent\n\n项目原有规则。\n", "utf8");
    await setupCodex({ cwd: repo.path, codexHome: codex.path });

    const result = await clearLouisGo({
      cwd: repo.path,
    });

    expect(result.targets).toContainEqual(
      expect.objectContaining({
        relativePath: "Agent.md",
        status: clearTargetStatuses.updated,
      }),
    );
    await expect(readdir(repo.path)).resolves.not.toContain("AGENTS.md");
    await expect(readFile(agentPath, "utf8")).resolves.toBe("# Existing Agent\n\n项目原有规则。\n");
  });
});

interface TempDir extends AsyncDisposable {
  readonly path: string;
}

async function createInitializedRepo(): Promise<TempDir> {
  const path = await mkdtemp(join(tmpdir(), "louisgo-clear-"));
  await execFileAsync("git", ["init"], { cwd: path });
  await initLouisGo({ cwd: path, now });

  return {
    path,
    async [Symbol.asyncDispose]() {
      await rm(path, { force: true, recursive: true });
    },
  };
}

async function createTempDir(): Promise<TempDir> {
  const path = await mkdtemp(join(tmpdir(), "louisgo-clear-codex-"));

  return {
    path,
    async [Symbol.asyncDispose]() {
      await rm(path, { force: true, recursive: true });
    },
  };
}
