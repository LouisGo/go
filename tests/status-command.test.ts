import { execFile } from "node:child_process";
import { mkdtemp, rm, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Writable } from "node:stream";
import { promisify } from "node:util";

import { describe, expect, it } from "vitest";

import { createCli } from "../src/cli.js";
import { createProtocolPaths } from "../src/protocol/paths.js";
import { initLouisGo } from "../src/services/init-service.js";

const execFileAsync = promisify(execFile);
const now = () => new Date("2026-05-01T12:00:00.000Z");

describe("status 命令", () => {
  it("状态正常时输出简洁摘要", async () => {
    await using repo = await createGitRepo();
    const initResult = await initLouisGo({ cwd: repo.path, now });
    const stdout = new MemoryWritable();

    const program = createCli({ cwd: repo.path, stdout });
    await program.parseAsync(["node", "louisgo", "status"]);

    expect(stdout.text).toContain("[assist/idle] complete, current task none");
    expect(stdout.text).toContain("verification status missing");
    expect(stdout.text).toContain("recovery source STATE");
    expect(stdout.text).toContain("Workspace:");
    expect(stdout.text).not.toContain("Issues to fix");
    expect(initResult.workspaceRoot.length).toBeGreaterThan(0);
  });

  it("缺失文件时输出可执行下一步", async () => {
    await using repo = await createGitRepo();
    const initResult = await initLouisGo({ cwd: repo.path, now });
    const paths = createProtocolPaths(initResult.workspaceRoot);
    const stdout = new MemoryWritable();

    await unlink(paths.mission);

    const program = createCli({ cwd: repo.path, stdout });
    await program.parseAsync(["node", "louisgo", "status"]);

    expect(stdout.text).toContain("[unknown/idle] incomplete");
    expect(stdout.text).toContain("Workspace:");
    expect(stdout.text).toContain(".louisgo/MISSION.md: Protocol path is missing");
    expect(stdout.text).toContain("Next: run louisgo init to create missing files");
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
  const path = await mkdtemp(join(tmpdir(), "louisgo-"));
  await execFileAsync("git", ["init"], { cwd: path });

  return {
    path,
    async [Symbol.asyncDispose]() {
      await rm(path, { force: true, recursive: true });
    },
  };
}
