import { execFile } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Writable } from "node:stream";
import { promisify } from "node:util";

import { describe, expect, it } from "vitest";

import { createCli } from "../src/cli.js";

const execFileAsync = promisify(execFile);

describe("skill 命令", () => {
  it("输出预设 skill 列表并可启用", async () => {
    await using repo = await createGitRepo();
    const stdout = new MemoryWritable();
    const program = createCli({ cwd: repo.path, stdout });

    await program.parseAsync(["node", "louisgo", "init", "--no-codex"]);
    await program.parseAsync(["node", "louisgo", "skill", "list"]);
    await program.parseAsync(["node", "louisgo", "skill", "enable", "grill"]);

    expect(stdout.text).toContain("grill [available]");
    expect(stdout.text).toContain("LouisGo skill enabled: grill");
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
  const path = await mkdtemp(join(tmpdir(), "louisgo-skill-command-"));
  await execFileAsync("git", ["init"], { cwd: path });

  return {
    path,
    async [Symbol.asyncDispose]() {
      await rm(path, { force: true, recursive: true });
    },
  };
}
