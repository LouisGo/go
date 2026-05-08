import { execFile } from "node:child_process";
import { access, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import { describe, expect, it } from "vitest";

import { appendRunLogEvent, readRunLog } from "../src/services/run-log-service.js";
import { initLouisGo } from "../src/services/init-service.js";

const execFileAsync = promisify(execFile);
const now = () => new Date("2026-05-01T12:00:00.000Z");

describe("run log service", () => {
  it("追加并读取诊断事件", async () => {
    await using repo = await createInitializedRepo();

    await appendRunLogEvent({
      cwd: repo.path,
      command: "context",
      outcome: "success",
      note: "budget=1500",
      now,
    });

    const log = await readRunLog({ cwd: repo.path });

    expect(log?.relativePath).toBe(".louisgo/RUNLOG.md");
    expect(log?.content).toContain("### 2026-05-01T12:00:00.000Z context");
    expect(log?.content).toContain("- outcome: success");
    expect(log?.content).toContain("- note:");
    expect(log?.content).toContain("budget=1500");
  });

  it("支持只读取最近 N 条事件", async () => {
    await using repo = await createInitializedRepo();

    await appendRunLogEvent({ cwd: repo.path, command: "init", outcome: "success", now });
    await appendRunLogEvent({ cwd: repo.path, command: "finish", outcome: "success", now });

    const log = await readRunLog({ cwd: repo.path, tailEvents: 1 });

    expect(log?.eventCount).toBe(1);
    expect(log?.content).toContain("finish");
    expect(log?.content).not.toContain(" init");
  });

  it("does not recreate .louisgo only to write a diagnostic event", async () => {
    await using repo = await createGitRepo("louisgo-runlog-missing-");

    await expect(
      appendRunLogEvent({
        cwd: repo.path,
        command: "status",
        outcome: "failure",
        now,
      }),
    ).rejects.toThrow("LouisGo protocol directory is missing");
    await expect(access(join(repo.path, ".louisgo"))).rejects.toMatchObject({
      code: "ENOENT",
    });
  });
});

interface TempRepo extends AsyncDisposable {
  readonly path: string;
}

async function createInitializedRepo(): Promise<TempRepo> {
  const repo = await createGitRepo("louisgo-runlog-");
  const path = repo.path;
  await initLouisGo({ cwd: path, now });

  return repo;
}

async function createGitRepo(prefix: string): Promise<TempRepo> {
  const path = await mkdtemp(join(tmpdir(), prefix));
  await execFileAsync("git", ["init"], { cwd: path });

  return {
    path,
    async [Symbol.asyncDispose]() {
      await rm(path, { force: true, recursive: true });
    },
  };
}
