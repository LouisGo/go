import { execFile } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Writable } from "node:stream";
import { promisify } from "node:util";

import { describe, expect, it } from "vitest";

import { createCli } from "../src/cli.js";
import { writeHandoffDraft } from "../src/protocol/handoff.js";

const execFileAsync = promisify(execFile);
const generatedAt = "2026-05-01T20:00:00+08:00";

describe("handoff promote 命令", () => {
  it("输出正式交接写入结果", async () => {
    await using repo = await createGitRepo();
    const stdout = new MemoryWritable();
    const stderr = new MemoryWritable();
    let exitCode = -1;

    await writeDraft(repo.path);

    const program = createCli({
      cwd: repo.path,
      stdout,
      stderr,
      now: () => new Date("2026-05-01T12:30:00.000Z"),
      setExitCode: (code) => {
        exitCode = code;
      },
    });

    await program.parseAsync(["node", "louisgo", "handoff", "promote"]);

    expect(exitCode).toBe(0);
    expect(stderr.text).toBe("");
    expect(stdout.text).toContain("LouisGo 正式交接已生成");
    expect(stdout.text).toContain("当前任务：T021");
    expect(stdout.text).toContain("验证状态：failed");
    expect(stdout.text).toContain("写入状态：新建");
    expect(stdout.text).toContain("下一步：运行 louisgo status 查看恢复状态");
  });

  it("草稿缺失时提示先 finish", async () => {
    await using repo = await createGitRepo();
    const stdout = new MemoryWritable();
    const stderr = new MemoryWritable();
    let exitCode = -1;

    const program = createCli({
      cwd: repo.path,
      stdout,
      stderr,
      setExitCode: (code) => {
        exitCode = code;
      },
    });

    await program.parseAsync(["node", "louisgo", "handoff", "promote"]);

    expect(exitCode).toBe(1);
    expect(stdout.text).toBe("");
    expect(stderr.text).toContain("交接提升失败：HANDOFF_DRAFT.md 不存在");
  });
});

class MemoryWritable extends Writable {
  text = "";

  override _write(
    chunk: string | Buffer,
    _encoding: BufferEncoding,
    callback: (error?: Error | null) => void,
  ): void {
    this.text += chunk.toString();
    callback();
  }
}

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

async function writeDraft(cwd: string): Promise<void> {
  await writeHandoffDraft({
    workspaceRoot: cwd,
    frontMatter: {
      mode: "assist",
      taskId: "T021",
      gitHead: "abc123",
      diffHash: "def456",
      verification: "failed",
      generatedAt,
    },
    body: {
      taskId: "T021",
      verification: "failed",
      gitDiffSummary: "当前工作区无 Git diff 摘要。",
      blockerSummary: "BLOCKER.md 为空。",
      confirmReqSummary: "无未解决确认请求。",
      quickSaveSummary: "无 Quick Save。",
      adrDrafts: [],
    },
  });
}
