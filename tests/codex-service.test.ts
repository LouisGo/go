import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import { describe, expect, it } from "vitest";

import { setupCodex } from "../src/services/codex-service.js";

const execFileAsync = promisify(execFile);

describe("Codex 集成安装", () => {
  it("写入 LouisGo skill 和 AGENTS 指令块", async () => {
    await using repo = await createGitRepo();
    await using codex = await createTempDir();

    const result = await setupCodex({ cwd: repo.path, codexHome: codex.path });

    expect(result.files).toHaveLength(4);
    await expect(
      readFile(join(codex.path, "skills", "louisgo-workflow", "SKILL.md"), "utf8"),
    ).resolves.toContain("$start");
    await expect(
      readFile(join(codex.path, "skills", "louisgo-workflow", "agents", "openai.yaml"), "utf8"),
    ).resolves.toContain("LouisGo Workflow");
    await expect(readFile(join(codex.path, "AGENTS.md"), "utf8")).resolves.toContain(
      "louisgo-codex:start",
    );
    await expect(readFile(join(repo.path, "AGENTS.md"), "utf8")).resolves.toContain(
      "louisgo status",
    );
  });

  it("重复安装时更新既有 AGENTS 指令块且保留其他内容", async () => {
    await using repo = await createGitRepo();
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

    const result = await setupCodex({ cwd: repo.path, codexHome: codex.path });
    const agents = await readFile(agentsPath, "utf8");

    expect(
      result.files.some((file) => file.filePath.endsWith("AGENTS.md") && file.status === "updated"),
    ).toBe(true);
    expect(agents).toContain("保留内容。");
    expect(agents).toContain("$finish");
    expect(agents).not.toContain("旧内容");
  });
});

interface TempDir extends AsyncDisposable {
  readonly path: string;
}

async function createGitRepo(): Promise<TempDir> {
  const path = await mkdtemp(join(tmpdir(), "louisgo-codex-repo-"));
  await execFileAsync("git", ["init"], { cwd: path });

  return {
    path,
    async [Symbol.asyncDispose]() {
      await rm(path, { force: true, recursive: true });
    },
  };
}

async function createTempDir(): Promise<TempDir> {
  const path = await mkdtemp(join(tmpdir(), "louisgo-codex-home-"));

  return {
    path,
    async [Symbol.asyncDispose]() {
      await rm(path, { force: true, recursive: true });
    },
  };
}
