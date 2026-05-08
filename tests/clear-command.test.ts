import { execFile } from "node:child_process";
import { access, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PassThrough, Writable } from "node:stream";
import { promisify } from "node:util";

import { describe, expect, it } from "vitest";

import { createCli } from "../src/cli.js";

const execFileAsync = promisify(execFile);

describe("clear 命令", () => {
  it("交互选择取消时提示风险并拒绝执行", async () => {
    await using repo = await createGitRepo();
    const stdout = new MemoryWritable();
    let exitCode: number | undefined;
    const initProgram = createCli({
      cwd: repo.path,
      stdout,
    });
    await initProgram.parseAsync(["node", "louisgo", "init", "--no-codex"]);
    const clearProgram = createCli({
      cwd: repo.path,
      stdin: createPromptInput("\n"),
      stdout,
      setExitCode(value) {
        exitCode = value;
      },
    });
    await clearProgram.parseAsync(["node", "louisgo", "clear"]);

    expect(stdout.text).toContain("危险操作");
    expect(stdout.text).toContain("会删除 .louisgo/");
    expect(stdout.text).toContain("请选择清理操作");
    expect(stdout.text).toContain("取消，不删除任何文件");
    expect(stdout.text).toContain("已取消，未删除任何文件。");
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
    const initProgram = createCli({
      cwd: repo.path,
      stdout,
    });
    await initProgram.parseAsync(["node", "louisgo", "init", "--no-codex"]);
    const clearProgram = createCli({
      cwd: repo.path,
      stdin: createPromptInput("\x1B[B\n"),
      stdout,
    });
    await clearProgram.parseAsync(["node", "louisgo", "clear"]);

    expect(stdout.text).toContain("我理解风险，清理当前项目 LouisGo 数据");
    expect(stdout.text).toContain("LouisGo 项目数据已清理");
    expect(stdout.text).toContain("deleted .louisgo");
    await expect(access(join(repo.path, ".louisgo"))).rejects.toMatchObject({
      code: "ENOENT",
    });
  });
});

class MemoryWritable extends Writable {
  text = "";
  columns = 80;
  rows = 24;
  isTTY = true;

  override _write(
    chunk: string | Buffer,
    _encoding: BufferEncoding,
    callback: (error?: Error | null) => void,
  ): void {
    this.text += chunk.toString();
    callback();
  }
}

type PromptInput = PassThrough & {
  isTTY: boolean;
  setRawMode: () => PromptInput;
};

function createPromptInput(keys: string): PromptInput {
  const input = new PassThrough() as PromptInput;
  input.isTTY = true;
  input.setRawMode = () => input;
  setTimeout(() => {
    input.write(keys);
  }, 100);

  return input;
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
