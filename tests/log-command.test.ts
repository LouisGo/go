import { execFile } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Writable } from "node:stream";
import { promisify } from "node:util";

import { describe, expect, it } from "vitest";

import { createCli } from "../src/cli.js";
import { initLouisGo } from "../src/services/init-service.js";
import { appendRunLogEvent } from "../src/services/run-log-service.js";

const execFileAsync = promisify(execFile);

describe("log 命令", () => {
  it("输出 LouisGo 诊断日志", async () => {
    await using repo = await createInitializedRepo();
    const stdout = new MemoryWritable();

    await appendRunLogEvent({
      cwd: repo.path,
      command: "context",
      outcome: "success",
      now: () => new Date("2026-05-01T12:00:00.000Z"),
    });

    const program = createCli({ cwd: repo.path, stdout });
    await program.parseAsync(["node", "louisgo", "log", "--tail", "1"]);

    expect(stdout.text).toContain("# Run Log");
    expect(stdout.text).toContain("context");
    expect(stdout.text).toContain("- outcome: success");
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
  const path = await mkdtemp(join(tmpdir(), "louisgo-log-command-"));
  await execFileAsync("git", ["init"], { cwd: path });
  await initLouisGo({ cwd: path, now: () => new Date("2026-05-01T12:00:00.000Z") });

  return {
    path,
    async [Symbol.asyncDispose]() {
      await rm(path, { force: true, recursive: true });
    },
  };
}
