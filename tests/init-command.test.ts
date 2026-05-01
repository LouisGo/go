import { execFile } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Writable } from "node:stream";
import { promisify } from "node:util";

import { describe, expect, it } from "vitest";

import { createCli } from "../src/cli.js";

const execFileAsync = promisify(execFile);

describe("init 命令", () => {
  it("输出初始化结果和下一步建议", async () => {
    await using tempDir = await createTempDir();
    const stdout = new MemoryWritable();

    await execFileAsync("git", ["init"], { cwd: tempDir.path });

    const program = createCli({
      cwd: tempDir.path,
      now: () => new Date("2026-05-01T12:00:00.000Z"),
      stdout,
    });
    await program.parseAsync(["node", "louisgo", "init"]);

    expect(stdout.text).toContain("LouisGo 初始化完成");
    expect(stdout.text).toContain("创建文件：6");
    expect(stdout.text).toContain("跳过文件：0");
    expect(stdout.text).toContain("下一步：运行 louisgo status 查看协议状态");
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
