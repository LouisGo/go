import { execFile } from "node:child_process";
import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
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

    expect(result.files).toHaveLength(20);
    await expect(
      readFile(join(codex.path, "skills", "init", "SKILL.md"), "utf8"),
    ).resolves.toContain("louisgo init");
    await expect(
      readFile(join(codex.path, "skills", "start", "SKILL.md"), "utf8"),
    ).resolves.toContain("louisgo context");
    await expect(
      readFile(join(codex.path, "skills", "start", "SKILL.md"), "utf8"),
    ).resolves.toContain("node ./dist/cli.js <subcommand>");
    await expect(
      readFile(join(codex.path, "skills", "start", "SKILL.md"), "utf8"),
    ).resolves.toContain("npx --yes louisgo@latest <subcommand>");
    await expect(
      readFile(join(codex.path, "skills", "start", "SKILL.md"), "utf8"),
    ).resolves.toContain("Start");
    await expect(
      readFile(join(codex.path, "skills", "start", "SKILL.md"), "utf8"),
    ).resolves.toContain("run `louisgo confirm`");
    await expect(
      readFile(join(codex.path, "skills", "start", "agents", "openai.yaml"), "utf8"),
    ).resolves.toContain('display_name: "$start"');
    await expect(
      readFile(join(codex.path, "skills", "start", "agents", "openai.yaml"), "utf8"),
    ).resolves.toContain("generate a layered context package");
    await expect(
      readFile(join(codex.path, "skills", "context", "SKILL.md"), "utf8"),
    ).resolves.toContain("louisgo context");
    await expect(
      readFile(join(codex.path, "skills", "finish", "SKILL.md"), "utf8"),
    ).resolves.toContain("louisgo finish");
    for (const skill of [
      "init",
      "start",
      "status",
      "context",
      "verify",
      "pause",
      "resume",
      "finish",
    ]) {
      const openAiYaml = await readFile(
        join(codex.path, "skills", skill, "agents", "openai.yaml"),
        "utf8",
      );
      expect(openAiYaml).toMatch(/short_description: "LouisGo /);
    }
    await expect(
      readFile(join(codex.path, "skills", "louisgo", "SKILL.md"), "utf8"),
    ).resolves.toContain("LouisGo Workflow");
    await expect(
      readFile(join(codex.path, "skills", "louisgo", "SKILL.md"), "utf8"),
    ).resolves.toContain("Restores LouisGo private task context");
    await expect(
      readFile(join(codex.path, "skills", "louisgo", "SKILL.md"), "utf8"),
    ).resolves.not.toContain("$handoff-promote");
    await expect(
      readFile(join(codex.path, "skills", "louisgo", "SKILL.md"), "utf8"),
    ).resolves.toContain(".louisgo/skills/manifest.json");
    await expect(
      readFile(join(codex.path, "skills", "louisgo", "agents", "openai.yaml"), "utf8"),
    ).resolves.toContain("recover private task context");
    await expect(readFile(join(codex.path, "AGENTS.md"), "utf8")).resolves.toContain(
      "louisgo-codex:start",
    );
    await expect(readFile(join(repo.path, "AGENTS.md"), "utf8")).resolves.toContain(
      "louisgo context",
    );
    await expect(readFile(join(repo.path, "AGENTS.md"), "utf8")).resolves.toContain(
      "Existing project instructions",
    );
    await expect(readFile(join(repo.path, "AGENTS.md"), "utf8")).resolves.toContain(
      ".louisgo/skills/manifest.json",
    );
    await expect(readFile(join(repo.path, "AGENTS.md"), "utf8")).resolves.toContain(
      "npx --yes louisgo@latest <subcommand>",
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
    expect(agents).toContain("Existing project instructions");
    expect(agents).not.toContain("旧内容");
  });

  it("项目已有 Agent.md 时复用既有文件而不是新建 AGENTS.md", async () => {
    await using repo = await createGitRepo();
    await using codex = await createTempDir();
    const agentPath = join(repo.path, "Agent.md");

    await writeFile(
      agentPath,
      `# Existing Agent

项目原有规则。
`,
      "utf8",
    );

    const result = await setupCodex({ cwd: repo.path, codexHome: codex.path });
    const agent = await readFile(agentPath, "utf8");

    expect(
      result.files.some((file) => file.filePath.endsWith("Agent.md") && file.status === "updated"),
    ).toBe(true);
    await expect(readdir(repo.path)).resolves.not.toContain("AGENTS.md");
    expect(agent).toContain("项目原有规则。");
    expect(agent).toContain("louisgo-codex:start");
    expect(agent).toContain("Existing project instructions");
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
