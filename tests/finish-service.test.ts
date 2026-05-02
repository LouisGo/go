import { execFile } from "node:child_process";
import { access, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import { describe, expect, it } from "vitest";

import { createConfirmReq } from "../src/protocol/confirm-req.js";
import { readFrontMatter } from "../src/protocol/frontmatter.js";
import { createProtocolPaths } from "../src/protocol/paths.js";
import { writeQuickSave } from "../src/protocol/quick-save.js";
import { handoffFrontMatterSchema } from "../src/protocol/schemas.js";
import { writeTestResults } from "../src/protocol/test-results.js";
import {
  finishCleanupStatuses,
  finishLouisGo,
  generateHandoffDraft,
} from "../src/services/finish-service.js";
import { initLouisGo } from "../src/services/init-service.js";
import { createAdrDraftTemplate } from "../src/templates/adr-draft.js";
import { getCurrentGitSnapshot } from "../src/verify/freshness.js";

const execFileAsync = promisify(execFile);
const initNow = () => new Date("2026-05-01T12:00:00.000Z");
const generatedNow = () => new Date("2026-05-01T12:30:00.000Z");
const timestamp = "2026-05-01T20:00:00+08:00";

describe("finish service HANDOFF_DRAFT 兼容生成", () => {
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
    expect(document.body).toContain("验证状态：passed");
    expect(document.body).toContain("## 当前工作区");
    expect(document.body).toContain("接手判断：验证通过且对应当前工作区");
    expect(document.body).toContain("无 Blocker。");
    expect(document.body).not.toContain("\n# Blocker\n");
  });

  it("生成验证失败草稿", async () => {
    await using repo = await createInitializedRepo();
    await writeVerificationResult(repo.path, "failed");

    const draft = await generateHandoffDraft({ cwd: repo.path, now: generatedNow });

    expect(draft.frontMatter.verification).toBe("failed");
    expect(draft.body).toContain("验证状态：failed");
    expect(draft.body).toContain("接手者应先查看失败原因并修复");
  });

  it("生成验证过期草稿", async () => {
    await using repo = await createInitializedRepo();
    const paths = createProtocolPaths(repo.path);

    await writeVerificationResult(repo.path, "passed");
    await writeFile(paths.blocker, "# Blocker\n\n验证后新增阻塞\n", "utf8");

    const draft = await generateHandoffDraft({ cwd: repo.path, now: generatedNow });

    expect(draft.frontMatter.verification).toBe("stale");
    expect(draft.body).toContain("验证状态：stale");
    expect(draft.body).toContain("验证结果已过期");
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

  it("包含 Quick Save 摘要", async () => {
    await using repo = await createInitializedRepo();

    await writeQuickSave({
      cwd: repo.path,
      mode: "assist",
      taskId: "T001",
      now: () => new Date("2026-05-01T12:15:00.000Z"),
    });
    await writeVerificationResult(repo.path, "passed");

    const draft = await generateHandoffDraft({ cwd: repo.path, now: generatedNow });

    expect(draft.body).toContain("存在 Quick Save：T001");
    expect(draft.body).toContain("QUICK_SAVE.md 没有填写具体正文。");
    expect(draft.body.match(/### Quick Save/g)).toHaveLength(1);
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

describe("finish service 收尾流程", () => {
  it("正常更新正式 HANDOFF.md 和 STATE.md", async () => {
    await using repo = await createInitializedRepo();
    const paths = createProtocolPaths(repo.path);
    await writeVerificationResult(repo.path, "passed");

    const result = await finishLouisGo({ cwd: repo.path, now: generatedNow });

    await expect(access(result.filePath)).resolves.toBeUndefined();
    await expect(access(paths.handoff)).resolves.toBeUndefined();
    await expect(access(paths.state)).resolves.toBeUndefined();
    await expect(readFile(paths.state, "utf8")).resolves.toContain("verification: passed");
    expect(result.verification).toBe("passed");
    expect(result.confirmReqCleanup).toBe(finishCleanupStatuses.absent);
    expect(result.quickSaveCleanup).toBe(finishCleanupStatuses.absent);
  });

  it("转存 Quick Save 后清理", async () => {
    await using repo = await createInitializedRepo();
    const paths = createProtocolPaths(repo.path);

    await writeQuickSave({
      cwd: repo.path,
      mode: "assist",
      taskId: "T001",
      now: () => new Date("2026-05-01T12:15:00.000Z"),
    });
    await writeVerificationResult(repo.path, "passed");

    const result = await finishLouisGo({ cwd: repo.path, now: generatedNow });

    expect(result.quickSaveCleanup).toBe(finishCleanupStatuses.cleaned);
    expect(result.body).toContain("存在 Quick Save：T001");
    expect(result.body).toContain("QUICK_SAVE.md 没有填写具体正文。");
    expect(result.body.match(/### Quick Save/g)).toHaveLength(1);
    await expectFileMissing(paths.quickSave);
  });

  it("转存 Confirm Request 后清理", async () => {
    await using repo = await createInitializedRepo();
    const paths = createProtocolPaths(repo.path);

    await createConfirmReq({
      cwd: repo.path,
      mode: "assist",
      taskId: "T001",
      now: () => new Date("2026-05-01T12:05:00.000Z"),
    });
    await writeVerificationResult(repo.path, "passed");

    const result = await finishLouisGo({ cwd: repo.path, now: generatedNow });

    expect(result.confirmReqCleanup).toBe(finishCleanupStatuses.cleaned);
    expect(result.body).toContain("存在未解决确认请求：T001");
    expect(result.body).toContain("## 选项");
    await expectFileMissing(paths.confirmReq);
  });

  it("验证缺失时草稿标记 missing", async () => {
    await using repo = await createInitializedRepo();

    const result = await finishLouisGo({ cwd: repo.path, now: generatedNow });

    expect(result.verification).toBe("missing");
    expect(result.frontMatter.verification).toBe("missing");
    expect(result.body).toContain("验证状态：missing");
    expect(result.body).toContain("没有可用验证结果");
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

async function expectFileMissing(filePath: string): Promise<void> {
  await expect(access(filePath)).rejects.toMatchObject({ code: "ENOENT" });
}
