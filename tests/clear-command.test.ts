import { execFile } from "node:child_process";
import { access, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Writable } from "node:stream";
import { promisify } from "node:util";

import { describe, expect, it } from "vitest";

import { createCli } from "../src/cli.js";
import { clearConfirmationPhrase } from "../src/services/clear-service.js";

const execFileAsync = promisify(execFile);

describe("clear 命令", () => {
  it("未确认时提示风险并拒绝执行", async () => {
    await using repo = await createGitRepo();
    const stdout = new MemoryWritable();
    const stderr = new MemoryWritable();
    let exitCode: number | undefined;
    const program = createCli({
      cwd: repo.path,
      stdout,
      stderr,
      setExitCode(value) {
        exitCode = value;
      },
    });

    await program.parseAsync(["node", "louisgo", "init", "--no-codex"]);
    await program.parseAsync(["node", "louisgo", "clear"]);

    expect(stdout.text).toContain("危险操作");
    expect(stdout.text).toContain("会删除 .louisgo/");
    expect(stderr.text).toContain(`--confirm "${clearConfirmationPhrase}"`);
    expect(exitCode).toBe(1);
    await expect(access(join(repo.path, ".louisgo"))).resolves.toBeUndefined();
  });

  it("dry-run 输出清理预览", async () => {
    await using repo = await createGitRepo();
    const stdout = new MemoryWritable();
    const program = createCli({ cwd: repo.path, stdout });

    await program.parseAsync(["node", "louisgo", "init", "--no-codex"]);
    await program.parseAsync(["node", "louisgo", "clear", "--dry-run"]);

    expect(stdout.text).toContain("清理预览");
    expect(stdout.text).toContain("planned .louisgo");
    expect(stdout.text).toContain("未执行删除");
    await expect(access(join(repo.path, ".louisgo"))).resolves.toBeUndefined();
  });

  it("确认后清理当前项目 LouisGo 数据", async () => {
    await using repo = await createGitRepo();
    const stdout = new MemoryWritable();
    const program = createCli({ cwd: repo.path, stdout });

    await program.parseAsync(["node", "louisgo", "init", "--no-codex"]);
    await program.parseAsync(["node", "louisgo", "clear", "--confirm", clearConfirmationPhrase]);

    expect(stdout.text).toContain("LouisGo 项目数据已清理");
    expect(stdout.text).toContain("deleted .louisgo");
    await expect(access(join(repo.path, ".louisgo"))).rejects.toMatchObject({
      code: "ENOENT",
    });
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
  const path = await mkdtemp(join(tmpdir(), "louisgo-clear-command-"));
  await execFileAsync("git", ["init"], { cwd: path });

  return {
    path,
    async [Symbol.asyncDispose]() {
      await rm(path, { force: true, recursive: true });
    },
  };
}
