import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import { describe, expect, it } from "vitest";

import { createConfirmReq } from "../src/protocol/confirm-req.js";
import { readFrontMatter } from "../src/protocol/frontmatter.js";
import { createProtocolPaths } from "../src/protocol/paths.js";
import { handoffFrontMatterSchema } from "../src/protocol/schemas.js";
import { writeTestResults } from "../src/protocol/test-results.js";
import { generateHandoffDraft } from "../src/services/finish-service.js";
import { initLouisGo } from "../src/services/init-service.js";
import { createAdrDraftTemplate } from "../src/templates/adr-draft.js";
import { getCurrentGitSnapshot } from "../src/verify/freshness.js";

const execFileAsync = promisify(execFile);
const initNow = () => new Date("2026-05-01T12:00:00.000Z");
const generatedNow = () => new Date("2026-05-01T12:30:00.000Z");
const timestamp = "2026-05-01T20:00:00+08:00";

describe("finish service HANDOFF_DRAFT 生成", () => {
  it("生成验证通过草稿", async () => {
    await using repo = await createInitializedRepo();
    await writeVerificationResult(repo.path, "passed");

    const draft = await generateHandoffDraft({ cwd: repo.path, now: generatedNow });
    const document = await readFrontMatter(draft.filePath, handoffFrontMatterSchema);

    expect(document.frontMatter).toMatchObject({
      mode: "assist",
      taskId: "T001",
      verification: "passed",
      generatedAt: "2026-05-01T12:30:00.000Z",
    });
    expect(document.body).toContain("当前验证状态：passed");
    expect(document.body).toContain("## Git diff 摘要");
  });

  it("生成验证失败草稿", async () => {
    await using repo = await createInitializedRepo();
    await writeVerificationResult(repo.path, "failed");

    const draft = await generateHandoffDraft({ cwd: repo.path, now: generatedNow });

    expect(draft.frontMatter.verification).toBe("failed");
    expect(draft.body).toContain("当前验证状态：failed");
  });

  it("生成验证过期草稿", async () => {
    await using repo = await createInitializedRepo();
    const paths = createProtocolPaths(repo.path);

    await writeVerificationResult(repo.path, "passed");
    await writeFile(paths.blocker, "# Blocker\n\n验证后新增阻塞\n", "utf8");

    const draft = await generateHandoffDraft({ cwd: repo.path, now: generatedNow });

    expect(draft.frontMatter.verification).toBe("stale");
    expect(draft.body).toContain("当前验证状态：stale");
  });

  it("包含 BLOCKER.md 摘要", async () => {
    await using repo = await createInitializedRepo();
    const paths = createProtocolPaths(repo.path);

    await writeFile(paths.blocker, "# Blocker\n\n- 验证失败：单测未通过\n", "utf8");
    await writeVerificationResult(repo.path, "passed");

    const draft = await generateHandoffDraft({ cwd: repo.path, now: generatedNow });

    expect(draft.body).toContain("验证失败：单测未通过");
  });

  it("包含未解决确认请求摘要", async () => {
    await using repo = await createInitializedRepo();

    await createConfirmReq({
      cwd: repo.path,
      mode: "assist",
      taskId: "T001",
      now: () => new Date("2026-05-01T12:05:00.000Z"),
    });
    await writeVerificationResult(repo.path, "passed");

    const draft = await generateHandoffDraft({ cwd: repo.path, now: generatedNow });

    expect(draft.body).toContain("存在未解决确认请求：T001");
    expect(draft.body).toContain("## 选项");
  });

  it("包含 ADR 草稿提示", async () => {
    await using repo = await createInitializedRepo();
    const paths = createProtocolPaths(repo.path);

    await writeFile(
      join(paths.adrDraftDir, "001-api.md"),
      createAdrDraftTemplate({ createdAt: timestamp, title: "API" }),
      "utf8",
    );
    await writeVerificationResult(repo.path, "passed");

    const draft = await generateHandoffDraft({ cwd: repo.path, now: generatedNow });

    expect(draft.body).toContain("- 001-api.md");
  });
});

interface TempRepo extends AsyncDisposable {
  readonly path: string;
}

async function createInitializedRepo(): Promise<TempRepo> {
  const path = await mkdtemp(join(tmpdir(), "louisgo-"));
  await execFileAsync("git", ["init"], { cwd: path });
  await initLouisGo({ cwd: path, now: initNow });

  return {
    path,
    async [Symbol.asyncDispose]() {
      await rm(path, { force: true, recursive: true });
    },
  };
}

async function writeVerificationResult(cwd: string, status: "passed" | "failed"): Promise<void> {
  const paths = createProtocolPaths(cwd);
  const snapshot = await getCurrentGitSnapshot({ cwd });

  await writeTestResults(paths.testResults, {
    command: ".louisgo/scripts/verify.sh",
    exitCode: status === "passed" ? 0 : 1,
    status,
    gitHead: snapshot.gitHead,
    diffHash: snapshot.diffHash,
    startedAt: "2026-05-01T20:00:00+08:00",
    completedAt: "2026-05-01T20:01:00+08:00",
    summary: status === "passed" ? "验证通过" : "验证失败",
  });
}
