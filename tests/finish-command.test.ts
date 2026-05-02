import { execFile } from "node:child_process";
import { access, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Writable } from "node:stream";
import { promisify } from "node:util";

import { describe, expect, it } from "vitest";

import { createCli } from "../src/cli.js";
import { createProtocolPaths } from "../src/protocol/paths.js";
import { initLouisGo } from "../src/services/init-service.js";

const execFileAsync = promisify(execFile);
const initNow = () => new Date("2026-05-01T12:00:00.000Z");
const finishNow = () => new Date("2026-05-01T12:30:00.000Z");

describe("finish 命令", () => {
  it("输出正式交接结果和下一步建议", async () => {
    await using repo = await createGitRepo();
    await initLouisGo({ cwd: repo.path, now: initNow });
    const paths = createProtocolPaths(repo.path);
    const stdout = new MemoryWritable();
    const stderr = new MemoryWritable();
    let exitCode = -1;

    const program = createCli({
      cwd: repo.path,
      stdout,
      stderr,
      now: finishNow,
      setExitCode: (code) => {
        exitCode = code;
      },
    });

    await program.parseAsync(["node", "louisgo", "finish"]);

    expect(exitCode).toBe(0);
    expect(stderr.text).toBe("");
    expect(stdout.text).toContain("LouisGo 正式交接已更新");
    expect(stdout.text).toContain("验证状态：missing");
    expect(stdout.text).toContain("STATE.md：已更新");
    expect(stdout.text).toContain("下一步：新会话会优先读取 HANDOFF.md");
    await expect(access(paths.handoff)).resolves.toBeUndefined();
    await expect(access(paths.state)).resolves.toBeUndefined();
    await expect(access(paths.handoffDraft)).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("协议缺失时提示先 init", async () => {
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

    await program.parseAsync(["node", "louisgo", "finish"]);

    expect(exitCode).toBe(1);
    expect(stdout.text).toBe("");
    expect(stderr.text).toContain("收尾失败：LouisGo 协议不完整，请先运行 louisgo init。");
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
