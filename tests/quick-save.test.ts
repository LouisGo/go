import { execFile } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import { describe, expect, it } from "vitest";

import { readFrontMatter } from "../src/protocol/frontmatter.js";
import { writeQuickSave } from "../src/protocol/quick-save.js";
import { missingTaskId, quickSaveFrontMatterSchema } from "../src/protocol/schemas.js";

const execFileAsync = promisify(execFile);
const now = () => new Date("2026-05-01T12:00:00.000Z");

describe("QUICK_SAVE 协议读写", () => {
  it("生成合法 Quick Save 并记录 Git 快照", async () => {
    await using repo = await createGitRepo();

    const result = await writeQuickSave({
      cwd: repo.path,
      mode: "assist",
      taskId: "T017",
      now,
    });
    const document = await readFrontMatter(result.filePath, quickSaveFrontMatterSchema);

    expect(document.frontMatter).toMatchObject({
      schema: "louisgo-quick-save-v1",
      mode: "assist",
      taskId: "T017",
      savedAt: "2026-05-01T12:00:00.000Z",
    });
    expect(document.frontMatter.gitHead).toBe("NO_HEAD");
    expect(document.frontMatter.diffHash).toMatch(/^[a-f0-9]{64}$/);
    expect(document.body).toContain("Current task: T017");
  });

  it("缺少任务时生成明确占位", async () => {
    await using repo = await createGitRepo();

    const result = await writeQuickSave({
      cwd: repo.path,
      mode: "assist",
      taskId: null,
      now,
    });

    expect(result.frontMatter.taskId).toBe(missingTaskId);
    expect(result.body).toContain(`task_id uses ${missingTaskId} as a placeholder`);
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
