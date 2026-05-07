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
  it("generates context package with sources and budget report", async () => {
    await using repo = await createInitializedRepo();
    const paths = createProtocolPaths(repo.path);
    await writeFile(
      paths.mission,
      `---
schema: louisgo-mission-v1
default_mode: assist
updated_at: "2026-05-01T12:00:00.000Z"
---

# Mission

- Build a durable prompt cache for AI coding.
`,
      "utf8",
    );
    await writeFile(
      paths.memory,
      `---
schema: louisgo-memory-v1
updated_at: "2026-05-01T12:00:00.000Z"
---

# Memory

## Stable Notes

- Keep context short.
`,
      "utf8",
    );

    const result = await generateContext({
      cwd: repo.path,
      budgetTokens: 2_000,
      goal: "experiment prompt cache",
    });

    expect(result.content).toContain("# LouisGo Context Package");
    expect(result.content).toContain("The user's current prompt is always the final task source");
    expect(result.content).toContain("Source: `.louisgo/MISSION.md`");
    expect(result.content).toContain("Source: `.louisgo/CAPABILITIES.md`");
    expect(result.content).toContain("Source: `.louisgo/MEMORY.md`");
    expect(result.content).toContain("Source: `.louisgo/STATE.md`");
    expect(result.content).toContain("Goal: experiment prompt cache");
    expect(result.sources).toContain(".louisgo/MISSION.md");
    expect(result.estimatedTokens).toBeLessThanOrEqual(result.budgetTokens + 500);
  });

  it("bypasses template-heavy protocol files on a fresh initialization", async () => {
    await using repo = await createInitializedRepo();

    const result = await generateContext({ cwd: repo.path, budgetTokens: 2_000 });

    expect(result.content).toContain("Cold Start");
    expect(result.content).toContain("no durable project memory or handoff exists yet");
    expect(result.content).not.toContain("Describe the project goal");
    expect(result.sources).toEqual(["cold-start"]);
  });

  it("generates subagent context capsule", async () => {
    await using repo = await createInitializedRepo();

    const result = await generateContext({
      cwd: repo.path,
      capsule: true,
      goal: "review verification flow",
    });

    expect(result.content).toContain("# LouisGo Subagent Context Capsule");
    expect(result.content).toContain("Goal: review verification flow");
    expect(result.content).toContain("Do not read `sessions/`");
  });

  it("truncates long files and preserves sources when budget is small", async () => {
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

${"long handoff content\n".repeat(2_000)}`,
      "utf8",
    );

    const result = await generateContext({ cwd: repo.path, budgetTokens: 4_000 });

    expect(result.truncated).toBe(true);
    expect(result.content).toContain("[semantic-truncated: .louisgo/HANDOFF.md]");
    expect(result.content).toContain("Context Budget Report");
    expect(result.sources).toContain(".louisgo/HANDOFF.md");
  });

  it("includes Stop Check section in execute phase", async () => {
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
      `- [ ] T001 complete first AI coding loop #completion: all tests pass\n`,
      "utf8",
    );

    const result = await generateContext({ cwd: repo.path, budgetTokens: 4_000 });
    expect(result.content).toContain("## Stop Check");
    expect(result.content).toContain("completion signal: all tests pass");
  });

  it("includes Explore Reminders section in explore phase", async () => {
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
    expect(result.content).toContain("Understand existing code and data before proposing changes");
  });

  it("idle phase does not add extra guidance sections", async () => {
    await using repo = await createInitializedRepo();

    const result = await generateContext({ cwd: repo.path, budgetTokens: 4_000 });
    expect(result.content).not.toContain("## Stop Check");
    expect(result.content).not.toContain("## Explore Reminders");
  });

  it("header shows work phase", async () => {
    await using repo = await createInitializedRepo();

    const result = await generateContext({ cwd: repo.path, budgetTokens: 4_000 });
    expect(result.content).toContain("Phase: idle");
  });

  it("includes CONTEXT.md in context when it exists", async () => {
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
    expect(result.content).toContain("Domain terms are defined in CONTEXT.md");
  });

  it("no CONTEXT.md means no domain term hint", async () => {
    await using repo = await createInitializedRepo();

    const result = await generateContext({ cwd: repo.path, budgetTokens: 4_000 });

    expect(result.sources).not.toContain(".louisgo/CONTEXT.md");
    expect(result.content).not.toContain("Domain terms are defined in CONTEXT.md");
  });

  it("skills are not auto-injected into context package", async () => {
    await using repo = await createInitializedRepo();

    const result = await generateContext({ cwd: repo.path, budgetTokens: 8_000 });

    expect(result.sources).not.toContain(".louisgo/skills/caveman.md");
    expect(result.sources).not.toContain(".louisgo/skills/diagnose.md");
    expect(result.sources).not.toContain(".louisgo/skills/grill.md");
    expect(result.sources).not.toContain(".louisgo/skills/zoom-out.md");
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
