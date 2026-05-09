import { execFile } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Writable } from "node:stream";
import { promisify } from "node:util";

import { describe, expect, it } from "vitest";

import { createCli } from "../src/cli.js";
import { initLouisGo } from "../src/services/init-service.js";

const execFileAsync = promisify(execFile);
const initNow = () => new Date("2026-05-01T12:00:00.000Z");
const finishNow = () => new Date("2026-05-01T12:30:00.000Z");

describe("finish 命令", () => {
  it("输出正式交接结果和下一步建议", async () => {
    await using repo = await createGitRepo();
    await initLouisGo({ cwd: repo.path, now: initNow });
    const stdout = new MemoryWritable();
    const stderr = new MemoryWritable();
    let exitCode = -1;

    const program = createCli({
      cwd: repo.path,
      stdout,
      stderr,
      louisgoHome: repo.louisgoHome,
      now: finishNow,
      setExitCode: (code) => {
        exitCode = code;
      },
    });

    await program.parseAsync(["node", "louisgo", "finish"]);

    expect(exitCode).toBe(0);
    expect(stderr.text).toBe("");
    expect(stdout.text).toContain("LouisGo private finish updated");
    expect(stdout.text).toContain("Verification status: missing");
    expect(stdout.text).toContain("Task state: updated");
    expect(stdout.text).toContain("→ Task phase finished in the private store");
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
    expect(stderr.text).toContain("Finish failed");
    expect(stderr.text).toContain("LouisGo protocol is incomplete");
    expect(stderr.text).toContain("Run louisgo init first.");
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
  readonly louisgoHome: string;
}

async function createGitRepo(): Promise<TempRepo> {
  const path = await mkdtemp(join(tmpdir(), "louisgo-"));
  const louisgoHome = await mkdtemp(join(tmpdir(), "louisgo-home-"));
  await execFileAsync("git", ["init"], { cwd: path });

  return {
    path,
    louisgoHome,
    async [Symbol.asyncDispose]() {
      await rm(path, { force: true, recursive: true });
      await rm(louisgoHome, { force: true, recursive: true });
    },
  };
}
