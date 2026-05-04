import { execFile } from "node:child_process";
import { mkdtemp, rm, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import { describe, expect, it } from "vitest";

import { createProtocolPaths } from "../src/protocol/paths.js";
import { generateContext } from "../src/services/context-service.js";
import { initLouisGo } from "../src/services/init-service.js";

const execFileAsync = promisify(execFile);
const now = () => new Date("2026-05-01T12:00:00.000Z");

describe("context service", () => {
  it("生成带来源和预算的上下文包", async () => {
    await using repo = await createInitializedRepo();

    const result = await generateContext({
      cwd: repo.path,
      budgetTokens: 2_000,
      goal: "实验验证 prompt cache",
    });

    expect(result.content).toContain("# LouisGo Context Package");
    expect(result.content).toContain("用户本轮请求永远是最终任务来源");
    expect(result.content).toContain("Source: `.louisgo/MISSION.md`");
    expect(result.content).toContain("Source: `.louisgo/CAPABILITIES.md`");
    expect(result.content).toContain("Source: `.louisgo/MEMORY.md`");
    expect(result.content).toContain("Source: `.louisgo/STATE.md`");
    expect(result.content).toContain("本轮目标：实验验证 prompt cache");
    expect(result.sources).toContain(".louisgo/MISSION.md");
    expect(result.estimatedTokens).toBeLessThanOrEqual(result.budgetTokens + 500);
  });

  it("生成 subagent context capsule", async () => {
    await using repo = await createInitializedRepo();

    const result = await generateContext({
      cwd: repo.path,
      capsule: true,
      goal: "审查验证流程",
    });

    expect(result.content).toContain("# LouisGo Subagent Context Capsule");
    expect(result.content).toContain("本轮目标：审查验证流程");
    expect(result.content).toContain("不要继续读取 `sessions/`");
  });

  it("预算较小时裁剪长文件并保留来源", async () => {
    await using repo = await createInitializedRepo();
    const paths = createProtocolPaths(repo.path);

    await writeFile(
      paths.handoff,
      `---
schema: louisgo-handoff-v1
mode: assist
task_id: T001
git_head: NO_HEAD
diff_hash: abc123
verification: missing
generated_at: "2026-05-01T12:00:00.000Z"
---

# Handoff

${"长交接内容\n".repeat(2_000)}`,
      "utf8",
    );

    const result = await generateContext({ cwd: repo.path, budgetTokens: 4_000 });

    expect(result.truncated).toBe(true);
    expect(result.content).toContain("[semantic-truncated: .louisgo/HANDOFF.md]");
    expect(result.content).toContain("Context Budget Report");
    expect(result.sources).toContain(".louisgo/HANDOFF.md");
  });

  it("execute 阶段在上下文头部包含 Stop Check", async () => {
    await using repo = await createInitializedRepo();
    const paths = createProtocolPaths(repo.path);

    await writeFile(
      paths.state,
      `---
schema: louisgo-state-v1
mode: assist
phase: execute
current_task: T001
verification: missing
git_head: NO_HEAD
diff_hash: NO_DIFF
updated_at: "2026-05-01T12:00:00.000Z"
---

# State
`,
      "utf8",
    );

    await writeFile(
      paths.roadmap,
      `- [ ] T001 完成第一次 AI 编程闭环 #completion: 所有测试通过\n`,
      "utf8",
    );

    const result = await generateContext({ cwd: repo.path, budgetTokens: 4_000 });
    expect(result.content).toContain("## Stop Check");
    expect(result.content).toContain("完成标准：所有测试通过");
  });

  it("explore 阶段在上下文头部包含 Explore Reminders", async () => {
    await using repo = await createInitializedRepo();
    const paths = createProtocolPaths(repo.path);

    await writeFile(
      paths.state,
      `---
schema: louisgo-state-v1
mode: assist
phase: explore
current_task: T001
verification: missing
git_head: NO_HEAD
diff_hash: NO_DIFF
updated_at: "2026-05-01T12:00:00.000Z"
---

# State
`,
      "utf8",
    );

    const result = await generateContext({ cwd: repo.path, budgetTokens: 4_000 });
    expect(result.content).toContain("## Explore Reminders");
    expect(result.content).toContain("先理解现有代码和数据");
  });

  it("idle 阶段不添加额外指导段落", async () => {
    await using repo = await createInitializedRepo();

    const result = await generateContext({ cwd: repo.path, budgetTokens: 4_000 });
    expect(result.content).not.toContain("## Stop Check");
    expect(result.content).not.toContain("## Explore Reminders");
  });

  it("上下文头部展示工作阶段", async () => {
    await using repo = await createInitializedRepo();

    const result = await generateContext({ cwd: repo.path, budgetTokens: 4_000 });
    expect(result.content).toContain("工作阶段：空闲（idle）");
  });

  it("存在 CONTEXT.md 时包含在上下文中", async () => {
    await using repo = await createInitializedRepo();
    const paths = createProtocolPaths(repo.path);

    await writeFile(
      paths.context,
      "# Domain Glossary\n\n- **Widget**: a UI component _Avoid_: gadget\n",
      "utf8",
    );

    const result = await generateContext({ cwd: repo.path, budgetTokens: 4_000 });

    expect(result.content).toContain("L2 Domain Glossary: CONTEXT.md");
    expect(result.content).toContain("Source: `.louisgo/CONTEXT.md`");
    expect(result.sources).toContain(".louisgo/CONTEXT.md");
    expect(result.content).toContain("领域术语见 CONTEXT.md");
  });

  it("不存在 CONTEXT.md 时上下文正常且不包含术语提示", async () => {
    await using repo = await createInitializedRepo();

    const result = await generateContext({ cwd: repo.path, budgetTokens: 4_000 });

    expect(result.sources).not.toContain(".louisgo/CONTEXT.md");
    expect(result.content).not.toContain("领域术语见 CONTEXT.md");
  });

  it("init 后上下文包含预设 skills", async () => {
    await using repo = await createInitializedRepo();

    const result = await generateContext({ cwd: repo.path, budgetTokens: 8_000 });

    expect(result.content).toContain("L2 Skill: caveman.md");
    expect(result.content).toContain("L2 Skill: diagnose.md");
    expect(result.content).toContain("L2 Skill: grill.md");
    expect(result.content).toContain("L2 Skill: zoom-out.md");
    expect(result.sources).toContain(".louisgo/skills/caveman.md");
    expect(result.sources).toContain(".louisgo/skills/diagnose.md");
    expect(result.sources).toContain(".louisgo/skills/grill.md");
    expect(result.sources).toContain(".louisgo/skills/zoom-out.md");
  });

  it("自定义 skill 文件出现在上下文中", async () => {
    await using repo = await createInitializedRepo();
    const paths = createProtocolPaths(repo.path);

    await writeFile(
      join(paths.skillsDir, "my-skill.md"),
      "# My Skill\n\nBe concise.\n",
      "utf8",
    );

    const result = await generateContext({ cwd: repo.path, budgetTokens: 8_000 });

    expect(result.content).toContain("L2 Skill: my-skill.md");
    expect(result.content).toContain("Be concise.");
    expect(result.sources).toContain(".louisgo/skills/my-skill.md");
  });

  it("删除 skill 后不再出现在上下文中", async () => {
    await using repo = await createInitializedRepo();
    const paths = createProtocolPaths(repo.path);

    await unlink(join(paths.skillsDir, "grill.md"));

    const result = await generateContext({ cwd: repo.path, budgetTokens: 8_000 });

    expect(result.content).not.toContain("L2 Skill: grill.md");
    expect(result.content).toContain("L2 Skill: caveman.md");
  });
});

interface TempRepo extends AsyncDisposable {
  readonly path: string;
}

async function createInitializedRepo(): Promise<TempRepo> {
  const path = await mkdtemp(join(tmpdir(), "louisgo-context-"));
  await execFileAsync("git", ["init"], { cwd: path });
  await initLouisGo({ cwd: path, now });

  return {
    path,
    async [Symbol.asyncDispose]() {
      await rm(path, { force: true, recursive: true });
    },
  };
}
