import { execFile } from "node:child_process";
import { access, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import { describe, expect, it } from "vitest";

import { readFrontMatter } from "../src/protocol/frontmatter.js";
import { writeHandoffDraft } from "../src/protocol/handoff.js";
import { createProtocolPaths } from "../src/protocol/paths.js";
import { handoffFrontMatterSchema, type VerificationStatus } from "../src/protocol/schemas.js";
import {
  HandoffServiceError,
  handoffPromoteStatuses,
  handoffServiceErrorCodes,
  promoteHandoff,
} from "../src/services/handoff-service.js";

const execFileAsync = promisify(execFile);
const generatedAt = "2026-05-01T20:00:00+08:00";
const confirmedNow = () => new Date("2026-05-01T12:30:00.000Z");

describe("handoff promote service", () => {
  it("草稿合法时提升成功", async () => {
    await using repo = await createGitRepo();
    const paths = createProtocolPaths(repo.path);
    await writeDraft(repo.path, "passed");

    const result = await promoteHandoff({ cwd: repo.path, now: confirmedNow });
    const document = await readFrontMatter(result.filePath, handoffFrontMatterSchema);

    expect(result.status).toBe(handoffPromoteStatuses.created);
    expect(document.frontMatter).toMatchObject({
      mode: "assist",
      taskId: "T021",
      verification: "passed",
      generatedAt,
      confirmedAt: "2026-05-01T12:30:00.000Z",
    });
    expect(document.body).toContain("# Handoff");
    expect(document.body).not.toContain("# Handoff Draft");
    await expect(access(paths.handoffDraft)).resolves.toBeUndefined();
  });

  it("草稿缺失时报错", async () => {
    await using repo = await createGitRepo();

    await expect(promoteHandoff({ cwd: repo.path })).rejects.toSatisfy(
      (error) =>
        error instanceof HandoffServiceError &&
        error.code === handoffServiceErrorCodes.draftMissing,
    );
  });

  it("草稿 schema 非法时报错", async () => {
    await using repo = await createGitRepo();
    const paths = createProtocolPaths(repo.path);

    await mkdir(paths.louisgoDir, { recursive: true });
    await writeFile(
      paths.handoffDraft,
      `---
schema: louisgo-handoff-v1
mode: assist
task_id: T021
git_head: abc123
diff_hash: def456
verification: maybe
generated_at: ${generatedAt}
---

# Handoff Draft
`,
      "utf8",
    );

    await expect(promoteHandoff({ cwd: repo.path })).rejects.toSatisfy(
      (error) =>
        error instanceof HandoffServiceError &&
        error.code === handoffServiceErrorCodes.draftInvalid,
    );
  });

  it.each(["failed", "stale"] as const)("如实保留 %s 验证状态", async (verification) => {
    await using repo = await createGitRepo();
    await writeDraft(repo.path, verification);

    const result = await promoteHandoff({ cwd: repo.path, now: confirmedNow });

    expect(result.frontMatter.verification).toBe(verification);
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

async function writeDraft(cwd: string, verification: VerificationStatus): Promise<void> {
  await writeHandoffDraft({
    workspaceRoot: cwd,
    frontMatter: {
      mode: "assist",
      taskId: "T021",
      gitHead: "abc123",
      diffHash: "def456",
      verification,
      generatedAt,
    },
    body: {
      taskId: "T021",
      verification,
      gitDiffSummary: "当前工作区无 Git diff 摘要。",
      blockerSummary: "BLOCKER.md 为空。",
      confirmReqSummary: "无未解决确认请求。",
      quickSaveSummary: "无 Quick Save。",
      adrDrafts: [],
    },
  });
}
