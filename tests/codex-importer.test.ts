import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import { describe, expect, it } from "vitest";

import { createProtocolPaths } from "../src/protocol/paths.js";
import { initLouisGo } from "../src/services/init-service.js";
import { importCodexStats, parseCodexUsageEvents } from "../src/stats/codex-importer.js";
import { readStatsEvents } from "../src/stats/store.js";

const execFileAsync = promisify(execFile);
const now = () => new Date("2026-05-01T12:00:00.000Z");

describe("Codex stats importer", () => {
  it("extracts usage fields without preserving prompt payload", () => {
    const sourceFileHash = "a".repeat(64);
    const events = parseCodexUsageEvents({
      content: createCodexJsonl(),
      sourceFile: "archived_sessions/session.jsonl",
      sourceFileHash,
      fallbackTimestamp: "2026-05-01T12:00:00.000Z",
    });

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      source: "codex",
      confidence: "actual",
      usage: {
        input_tokens: 100,
        cached_input_tokens: 40,
        output_tokens: 5,
        reasoning_output_tokens: 2,
        total_tokens: 105,
      },
      codex: {
        source_file: "archived_sessions/session.jsonl",
        usage_kind: "last_token_usage",
      },
    });
    expect(JSON.stringify(events)).not.toContain("secret prompt");
  });

  it("imports Codex usage idempotently", async () => {
    await using repo = await createInitializedRepo();
    await using codex = await createTempDir();
    const sessionPath = join(codex.path, "archived_sessions", "session.jsonl");

    await mkdir(join(codex.path, "archived_sessions"), { recursive: true });
    await writeFile(sessionPath, createCodexJsonl(), "utf8");

    const first = await importCodexStats({
      cwd: repo.path,
      codexHome: codex.path,
      now,
    });
    const second = await importCodexStats({
      cwd: repo.path,
      codexHome: codex.path,
      now,
    });
    const events = await readStatsEvents({ cwd: repo.path });
    const paths = createProtocolPaths(repo.path);

    expect(first).toMatchObject({
      scannedFiles: 1,
      matchedEvents: 1,
      importedEvents: 1,
    });
    expect(second.importedEvents).toBe(0);
    expect(events).toHaveLength(1);
    await expect(readFile(paths.statsImports, "utf8")).resolves.toContain("session.jsonl");
  });

  it("dry run does not write stats files", async () => {
    await using repo = await createInitializedRepo();
    await using codex = await createTempDir();
    const sessionPath = join(codex.path, "session.jsonl");

    await writeFile(sessionPath, createCodexJsonl(), "utf8");

    const result = await importCodexStats({
      cwd: repo.path,
      codexHome: codex.path,
      dryRun: true,
      now,
    });

    expect(result).toMatchObject({
      dryRun: true,
      matchedEvents: 1,
      importedEvents: 0,
    });
    await expect(readStatsEvents({ cwd: repo.path })).resolves.toHaveLength(0);
  });
});

function createCodexJsonl(): string {
  return `${JSON.stringify({
    timestamp: "2026-05-01T12:00:00Z",
    type: "event_msg",
    payload: {
      session_id: "session-1",
      text: "secret prompt must not be stored",
      info: {
        last_token_usage: {
          input_tokens: 100,
          cached_input_tokens: 40,
          output_tokens: 5,
          reasoning_output_tokens: 2,
          total_tokens: 105,
        },
        total_token_usage: {
          input_tokens: 500,
          cached_input_tokens: 200,
          output_tokens: 25,
          reasoning_output_tokens: 10,
          total_tokens: 525,
        },
      },
    },
  })}\n`;
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
