import { execFile } from "node:child_process";
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import { describe, expect, it } from "vitest";

import { createProtocolPaths } from "../src/protocol/paths.js";
import {
  disableSkill,
  enableSkill,
  listSkills,
  skillDisableStatuses,
  skillEnableStatuses,
} from "../src/services/skill-service.js";
import { initLouisGo } from "../src/services/init-service.js";

const execFileAsync = promisify(execFile);
const now = () => new Date("2026-05-01T12:00:00.000Z");

describe("skill service", () => {
  it("按需启用和停用 LouisGo 管理的预设 skill", async () => {
    await using repo = await createInitializedRepo();
    const paths = createProtocolPaths(repo.path);

    const listedBefore = await listSkills({ cwd: repo.path });
    expect(listedBefore.skills.find((skill) => skill.id === "grill")).toMatchObject({
      enabled: false,
      conflicts: [],
    });

    const enabled = await enableSkill("grill", { cwd: repo.path });
    expect(enabled.status).toBe(skillEnableStatuses.enabled);
    await expect(readFile(join(paths.skillsDir, "grill.md"), "utf8")).resolves.toMatch(
      /^---\nname: grill-me/m,
    );
    await expect(readFile(join(paths.skillsDir, "grill.md"), "utf8")).resolves.toContain(
      "louisgo-managed-skill:grill",
    );
    const manifest = JSON.parse(await readFile(paths.skillsManifest, "utf8")) as {
      schema: string;
      platforms: { claude: { status: string }; codex: { status: string } };
      skills: Array<{
        id: string;
        name: string;
        relativePath: string;
        aliases: string[];
      }>;
    };
    expect(manifest).toMatchObject({
      schema: "louisgo-local-skill-index-v1",
      platforms: {
        codex: { status: "active" },
        claude: { status: "reserved" },
      },
      skills: [
        {
          id: "grill",
          name: "grill-me",
          relativePath: ".louisgo/skills/grill.md",
        },
      ],
    });
    expect(manifest.skills[0]?.aliases).toContain("grill-me");

    const enabledAgain = await enableSkill("grill", { cwd: repo.path });
    expect(enabledAgain.status).toBe(skillEnableStatuses.unchanged);

    const disabled = await disableSkill("grill", { cwd: repo.path });
    expect(disabled.status).toBe(skillDisableStatuses.disabled);
    await expect(access(join(paths.skillsDir, "grill.md"))).rejects.toMatchObject({
      code: "ENOENT",
    });
    await expect(access(paths.skillsManifest)).rejects.toMatchObject({
      code: "ENOENT",
    });
  });

  it("发现项目内同名 Codex skill 时阻止启用", async () => {
    await using repo = await createInitializedRepo();
    await mkdir(join(repo.path, ".codex", "skills", "caveman"), { recursive: true });
    await writeFile(
      join(repo.path, ".codex", "skills", "caveman", "SKILL.md"),
      `---
name: caveman
---

# Existing
`,
      "utf8",
    );

    const result = await enableSkill("caveman", { cwd: repo.path });

    expect(result.status).toBe(skillEnableStatuses.blocked);
    expect(result.conflicts).toContain(".codex/skills/caveman/SKILL.md");
  });

  it("不删除用户自己维护的同名 skill 文件", async () => {
    await using repo = await createInitializedRepo();
    const paths = createProtocolPaths(repo.path);
    await mkdir(paths.skillsDir, { recursive: true });
    await writeFile(join(paths.skillsDir, "caveman.md"), "user owned\n", "utf8");

    const result = await disableSkill("caveman", { cwd: repo.path });

    expect(result.status).toBe(skillDisableStatuses.blocked);
    await expect(readFile(join(paths.skillsDir, "caveman.md"), "utf8")).resolves.toBe(
      "user owned\n",
    );
  });
});

interface TempRepo extends AsyncDisposable {
  readonly path: string;
}

async function createInitializedRepo(): Promise<TempRepo> {
  const path = await mkdtemp(join(tmpdir(), "louisgo-skill-"));
  await execFileAsync("git", ["init"], { cwd: path });
  await initLouisGo({ cwd: path, now });

  return {
    path,
    async [Symbol.asyncDispose]() {
      await rm(path, { force: true, recursive: true });
    },
  };
}
