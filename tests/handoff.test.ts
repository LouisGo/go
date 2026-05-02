import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { readFrontMatter } from "../src/protocol/frontmatter.js";
import { createHandoffDraftBody, writeHandoffDraft } from "../src/protocol/handoff.js";
import { handoffFrontMatterSchema, missingTaskId } from "../src/protocol/schemas.js";

const timestamp = "2026-05-01T20:00:00+08:00";

describe("HANDOFF_DRAFT 协议写入", () => {
  it("写入合法 Front Matter 和草稿正文", async () => {
    await using tempDir = await createTempDir();

    const result = await writeHandoffDraft({
      workspaceRoot: tempDir.path,
      frontMatter: {
        mode: "assist",
        taskId: "T019",
        gitHead: "abc123",
        diffHash: "def456",
        verification: "passed",
        generatedAt: timestamp,
      },
      body: {
        taskId: "T019",
        verification: "passed",
        gitDiffSummary: "当前工作区无 Git diff 摘要。",
        blockerSummary: "BLOCKER.md 为空。",
        confirmReqSummary: "无未解决确认请求。",
        quickSaveSummary: "无 Quick Save。",
        adrDrafts: [],
      },
    });

    await expect(readFrontMatter(result.filePath, handoffFrontMatterSchema)).resolves.toEqual(
      expect.objectContaining({
        frontMatter: result.frontMatter,
      }),
    );
    expect(result.frontMatter).toMatchObject({
      mode: "assist",
      taskId: "T019",
      verification: "passed",
      generatedAt: timestamp,
    });
    expect(result.body).toContain("## Git diff 摘要");
    expect(result.body).toContain("## 下一步");
  });

  it("缺少任务时生成明确占位正文", () => {
    expect(
      createHandoffDraftBody({
        taskId: null,
        verification: "missing",
        gitDiffSummary: "当前工作区无 Git diff 摘要。",
        blockerSummary: "BLOCKER.md 为空。",
        confirmReqSummary: "无未解决确认请求。",
        quickSaveSummary: "无 Quick Save。",
        adrDrafts: [],
      }),
    ).toContain(`task_id 使用 ${missingTaskId} 占位`);
  });
});

interface TempDir extends AsyncDisposable {
  readonly path: string;
}

async function createTempDir(): Promise<TempDir> {
  const path = await mkdtemp(join(tmpdir(), "louisgo-"));

  return {
    path,
    async [Symbol.asyncDispose]() {
      await rm(path, { force: true, recursive: true });
    },
  };
}
