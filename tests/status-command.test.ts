import { execFile } from "node:child_process";
import { mkdtemp, rm, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Writable } from "node:stream";
import { promisify } from "node:util";

import { describe, expect, it } from "vitest";

import { createCli } from "../src/cli.js";
import { createProtocolPaths } from "../src/protocol/paths.js";
import { initLouisGo } from "../src/services/init-service.js";

const execFileAsync = promisify(execFile);
const now = () => new Date("2026-05-01T12:00:00.000Z");

describe("status 命令", () => {
  it("状态正常时输出简洁摘要", async () => {
    await using repo = await createGitRepo();
    const initResult = await initLouisGo({ cwd: repo.path, now });
    const stdout = new MemoryWritable();

    const program = createCli({ cwd: repo.path, stdout });
    await program.parseAsync(["node", "louisgo", "status"]);

    expect(stdout.text).toContain("[assist] 协议完整，当前任务 T001");
    expect(stdout.text).toContain("验证状态 missing");
    expect(stdout.text).toContain("恢复来源 none");
    expect(stdout.text).not.toContain("需要处理的问题");
    expect(initResult.workspaceRoot.length).toBeGreaterThan(0);
  });

  it("缺失文件时输出可执行下一步", async () => {
    await using repo = await createGitRepo();
    const initResult = await initLouisGo({ cwd: repo.path, now });
    const paths = createProtocolPaths(initResult.workspaceRoot);
    const stdout = new MemoryWritable();

    await unlink(paths.mission);

    const program = createCli({ cwd: repo.path, stdout });
    await program.parseAsync(["node", "louisgo", "status"]);

    expect(stdout.text).toContain("[unknown] 协议不完整");
    expect(stdout.text).toContain(".louisgo/MISSION.md：协议路径缺失");
    expect(stdout.text).toContain("下一步：运行 louisgo init 创建缺失文件");
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
