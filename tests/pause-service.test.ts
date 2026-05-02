import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import { describe, expect, it } from "vitest";

import { readFrontMatter } from "../src/protocol/frontmatter.js";
import { createProtocolPaths } from "../src/protocol/paths.js";
import { quickSaveFrontMatterSchema } from "../src/protocol/schemas.js";
import { initLouisGo } from "../src/services/init-service.js";
import {
  pauseLouisGo,
  pauseResultStatuses,
  PauseServiceError,
  pauseServiceErrorCodes,
} from "../src/services/pause-service.js";

const execFileAsync = promisify(execFile);
const initNow = () => new Date("2026-05-01T12:00:00.000Z");

describe("pause service", () => {
  it("正常生成 Quick Save", async () => {
    await using repo = await createGitRepo();
    await initLouisGo({ cwd: repo.path, now: initNow });

    const result = await pauseLouisGo({
      cwd: repo.path,
      now: () => new Date("2026-05-01T12:10:00.000Z"),
    });
    const document = await readFrontMatter(result.filePath, quickSaveFrontMatterSchema);

    expect(result.status).toBe(pauseResultStatuses.created);
    expect(result.frontMatter).toMatchObject({
      mode: "assist",
      taskId: "T001",
      savedAt: "2026-05-01T12:10:00.000Z",
    });
    expect(result.frontMatter.diffHash).toMatch(/^[a-f0-9]{64}$/);
    expect(document.body).toContain("当前任务：T001");
  });

  it("已存在 Quick Save 时更新暂停点，并保留 BLOCKER 和 HANDOFF", async () => {
    await using repo = await createGitRepo();
    const initResult = await initLouisGo({ cwd: repo.path, now: initNow });
    const paths = createProtocolPaths(initResult.workspaceRoot);
    const blockerContent = "# Blocker\n\n已有阻塞项\n";
    const handoffContent = createHandoff();

    await writeFile(paths.blocker, blockerContent, "utf8");
    await writeFile(paths.handoff, handoffContent, "utf8");

    const first = await pauseLouisGo({
      cwd: repo.path,
      now: () => new Date("2026-05-01T12:10:00.000Z"),
    });
    const second = await pauseLouisGo({
      cwd: repo.path,
      now: () => new Date("2026-05-01T12:20:00.000Z"),
    });

    expect(first.status).toBe(pauseResultStatuses.created);
    expect(second.status).toBe(pauseResultStatuses.updated);
    expect(second.frontMatter.savedAt).toBe("2026-05-01T12:20:00.000Z");
    await expect(readFile(paths.blocker, "utf8")).resolves.toBe(blockerContent);
    await expect(readFile(paths.handoff, "utf8")).resolves.toBe(handoffContent);
  });

  it("缺少协议文件时提示先 init", async () => {
    await using repo = await createGitRepo();

    await expect(pauseLouisGo({ cwd: repo.path })).rejects.toSatisfy(
      (error: unknown) =>
        error instanceof PauseServiceError &&
        error.code === pauseServiceErrorCodes.protocolIncomplete &&
        error.message.includes("louisgo init") &&
        error.issues.length > 0,
    );
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

function createHandoff(): string {
  return `---
schema: louisgo-handoff-v1
mode: assist
task_id: T001
git_head: NO_HEAD
diff_hash: abc123
verification: missing
generated_at: "2026-05-01T12:00:00.000Z"
---

# Handoff
`;
}
