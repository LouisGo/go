import { execFile } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Writable } from "node:stream";
import { promisify } from "node:util";

import { describe, expect, it } from "vitest";

import { createCli } from "../src/cli.js";

const execFileAsync = promisify(execFile);

describe("codex setup 命令", () => {
  it("输出 Codex 集成安装结果", async () => {
    await using repo = await createGitRepo();
    await using codex = await createTempDir();
    const stdout = new MemoryWritable();
    const program = createCli({ cwd: repo.path, codexHome: codex.path, stdout });

    await program.parseAsync(["node", "louisgo", "codex", "setup"]);

    expect(stdout.text).toContain("LouisGo Codex 集成完成");
    expect(stdout.text).toContain("skills/start/SKILL.md");
    expect(stdout.text).toContain("skills/finish/SKILL.md");
    expect(stdout.text).toContain("下一步：新开 Codex 会话或重启 Codex 后输入 $start");
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

async function createGitRepo(): Promise<TempDir> {
  const path = await mkdtemp(join(tmpdir(), "louisgo-codex-repo-"));
  await execFileAsync("git", ["init"], { cwd: path });

  return {
    path,
    async [Symbol.asyncDispose]() {
      await rm(path, { force: true, recursive: true });
    },
  };
}

async function createTempDir(): Promise<TempDir> {
  const path = await mkdtemp(join(tmpdir(), "louisgo-codex-home-"));

  return {
    path,
    async [Symbol.asyncDispose]() {
      await rm(path, { force: true, recursive: true });
    },
  };
}
