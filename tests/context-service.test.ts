import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
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

    const result = await generateContext({ cwd: repo.path, budgetTokens: 1_000 });

    expect(result.truncated).toBe(true);
    expect(result.content).toContain("[semantic-truncated: .louisgo/HANDOFF.md]");
    expect(result.content).toContain("Context Budget Report");
    expect(result.sources).toContain(".louisgo/HANDOFF.md");
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
