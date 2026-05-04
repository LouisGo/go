import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable, Writable } from "node:stream";
import { promisify } from "node:util";

import { describe, expect, it } from "vitest";

import { createCli } from "../src/cli.js";
import { createProtocolPaths } from "../src/protocol/paths.js";
import { initLouisGo } from "../src/services/init-service.js";

const execFileAsync = promisify(execFile);
const now = () => new Date("2026-05-01T12:00:00.000Z");

describe("confirm 命令", () => {
  it("没有确认请求时输出空状态", async () => {
    await using repo = await createGitRepo();
    await initLouisGo({ cwd: repo.path, now });
    const stdout = new MemoryWritable();

    const program = createCli({ cwd: repo.path, stdout });
    await program.parseAsync(["node", "louisgo", "confirm"]);

    expect(stdout.text).toContain("当前没有未解决确认请求");
  });

  it("友好展示确认请求选项", async () => {
    await using repo = await createGitRepo();
    const initResult = await initLouisGo({ cwd: repo.path, now });
    const paths = createProtocolPaths(initResult.workspaceRoot);
    const stdout = new MemoryWritable();

    await writeFile(paths.confirmReq, createConfirmReq(), "utf8");

    const program = createCli({ cwd: repo.path, stdout });
    await program.parseAsync(["node", "louisgo", "confirm"]);

    expect(stdout.text).toContain("确认请求：T002");
    expect(stdout.text).toContain("来源：.louisgo/CONFIRM_REQ.md");
    expect(stdout.text).toContain("背景：");
    expect(stdout.text).toContain("需要选择发布方式");
    expect(stdout.text).toContain("- A. 公开发布");
    expect(stdout.text).toContain("- B. 暂不发布");
    expect(stdout.text).toContain("下一步：运行 louisgo confirm --choice A");
  });

  it("支持用 --choice 选择选项并输出结构化下一步", async () => {
    await using repo = await createGitRepo();
    const initResult = await initLouisGo({ cwd: repo.path, now });
    const paths = createProtocolPaths(initResult.workspaceRoot);
    const stdout = new MemoryWritable();

    await writeFile(paths.confirmReq, createConfirmReq(), "utf8");

    const program = createCli({ cwd: repo.path, stdout });
    await program.parseAsync(["node", "louisgo", "confirm", "--choice", "B"]);

    expect(stdout.text).toContain("已选择：B. 暂不发布");
    expect(stdout.text).toContain("任务：T002");
    expect(stdout.text).toContain("AI 应基于该选择继续执行");
  });

  it("支持交互式选择选项", async () => {
    await using repo = await createGitRepo();
    const initResult = await initLouisGo({ cwd: repo.path, now });
    const paths = createProtocolPaths(initResult.workspaceRoot);
    const stdout = new MemoryWritable();

    await writeFile(paths.confirmReq, createConfirmReq(), "utf8");

    const program = createCli({
      cwd: repo.path,
      stdin: Readable.from(["B\n"]),
      stdout,
    });
    await program.parseAsync(["node", "louisgo", "confirm", "--interactive"]);

    expect(stdout.text).toContain("请选择 A/B");
    expect(stdout.text).toContain("已选择：B. 暂不发布");
    expect(stdout.text).toContain("AI 应基于该选择继续执行");
  });

  it("支持交互式输入补充说明", async () => {
    await using repo = await createGitRepo();
    const initResult = await initLouisGo({ cwd: repo.path, now });
    const paths = createProtocolPaths(initResult.workspaceRoot);
    const stdout = new MemoryWritable();

    await writeFile(paths.confirmReq, createConfirmReq(), "utf8");

    const program = createCli({
      cwd: repo.path,
      stdin: Readable.from(["改用 Apache-2.0\n"]),
      stdout,
    });
    await program.parseAsync(["node", "louisgo", "confirm", "-i"]);

    expect(stdout.text).toContain("已输入补充说明：改用 Apache-2.0");
    expect(stdout.text).toContain("AI 应基于该补充说明继续执行");
  });
});

function createConfirmReq(): string {
  return `---
schema: louisgo-confirm-req-v1
mode: assist
task_id: T002
status: open
created_at: "2026-05-01T12:00:00.000Z"
---

# Confirm Request

## 背景

需要选择发布方式。

## 选项

- A. 公开发布
- B. 暂不发布

## 建议

选择 A。
`;
}

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
