import { execFile } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Writable } from "node:stream";
import { promisify } from "node:util";

import { describe, expect, it } from "vitest";

import { createCli } from "../src/cli.js";
import { readStatsEvents } from "../src/stats/store.js";
import { initLouisGo } from "../src/services/init-service.js";

const execFileAsync = promisify(execFile);

describe("context 命令", () => {
  it("输出 prompt 上下文包", async () => {
    await using repo = await createInitializedRepo();
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

    await program.parseAsync([
      "node",
      "louisgo",
      "context",
      "--budget",
      "2000",
      "--goal",
      "外部项目实验",
    ]);

    expect(exitCode).toBe(0);
    expect(stderr.text).toBe("");
    expect(stdout.text).toContain("# LouisGo Context Package");
    expect(stdout.text).toContain("Goal: 外部项目实验");
    expect(stdout.text).toContain("Cold Start");
    expect(stdout.text).toContain("Source: `cold-start`");

    const events = await readStatsEvents({ cwd: repo.path });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      source: "context",
      tool: "louisgo",
      event: "louisgo.context",
      confidence: "estimated",
    });
    expect(events[0]?.context?.sections.some((section) => section.source === "cold-start")).toBe(
      true,
    );
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

    await program.parseAsync(["node", "louisgo", "context"]);

    expect(exitCode).toBe(1);
    expect(stdout.text).toBe("");
    expect(stderr.text).toContain(
      "Context generation failed: LouisGo protocol is incomplete. Run louisgo init first.",
    );
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

async function createInitializedRepo(): Promise<TempRepo> {
  const repo = await createGitRepo();
  await initLouisGo({ cwd: repo.path, now: () => new Date("2026-05-01T12:00:00.000Z") });
  return repo;
}

async function createGitRepo(): Promise<TempRepo> {
  const path = await mkdtemp(join(tmpdir(), "louisgo-context-command-"));
  await execFileAsync("git", ["init"], { cwd: path });

  return {
    path,
    async [Symbol.asyncDispose]() {
      await rm(path, { force: true, recursive: true });
    },
  };
}
