import { execFile } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Writable } from "node:stream";
import { promisify } from "node:util";

import { describe, expect, it } from "vitest";

import { createCli } from "../src/cli.js";
import { initLouisGo } from "../src/services/init-service.js";
import { readStatsEvents } from "../src/stats/store.js";

const execFileAsync = promisify(execFile);
const now = () => new Date("2026-05-01T12:00:00.000Z");

describe("stats 命令", () => {
  it("无 stats 文件时输出空状态", async () => {
    await using repo = await createInitializedRepo();
    const stdout = new MemoryWritable();
    const program = createCli({ cwd: repo.path, stdout, now });

    await program.parseAsync(["node", "louisgo", "stats"]);

    expect(stdout.text).toContain("LouisGo Stats");
    expect(stdout.text).toContain("Events: 0");
    expect(stdout.text).toContain("Run `louisgo context`");
  });

  it("支持 JSON 输出", async () => {
    await using repo = await createInitializedRepo();
    const stdout = new MemoryWritable();
    const program = createCli({ cwd: repo.path, stdout, now });

    await program.parseAsync(["node", "louisgo", "stats", "--json"]);

    const parsed = JSON.parse(stdout.text) as { readonly eventCount: number };
    expect(parsed.eventCount).toBe(0);
  });

  it("Codex dry-run import 不写入 stats store", async () => {
    await using repo = await createInitializedRepo();
    await using codex = await createTempDir();
    const stdout = new MemoryWritable();
    const sessionPath = join(codex.path, "session.jsonl");
    const program = createCli({ cwd: repo.path, stdout, now });

    await mkdir(codex.path, { recursive: true });
    await writeFile(
      sessionPath,
      `${JSON.stringify({
        timestamp: "2026-05-01T12:00:00Z",
        payload: {
          info: {
            last_token_usage: {
              input_tokens: 10,
              cached_input_tokens: 4,
              output_tokens: 2,
              reasoning_output_tokens: 1,
              total_tokens: 12,
            },
          },
        },
      })}\n`,
      "utf8",
    );

    await program.parseAsync([
      "node",
      "louisgo",
      "stats",
      "import",
      "codex",
      "--codex-home",
      codex.path,
      "--dry-run",
    ]);

    expect(stdout.text).toContain("Codex stats dry run");
    expect(stdout.text).toContain("Matched usage events: 1");
    await expect(readStatsEvents({ cwd: repo.path })).resolves.toHaveLength(0);
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

async function createInitializedRepo(): Promise<TempDir> {
  const repo = await createTempDir();
  await execFileAsync("git", ["init"], { cwd: repo.path });
  await initLouisGo({ cwd: repo.path, now });
  return repo;
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
