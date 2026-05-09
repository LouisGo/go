import { createHash } from "node:crypto";
import { readdir, readFile, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { join, relative, resolve, sep } from "node:path";

import { findGitRoot } from "../fs/workspace.js";
import { isNodeError, pathExists } from "../internal/utils.js";
import {
  createCodexUsageEvent,
  tokenUsageSchema,
  type CodexStats,
  type StatsEvent,
  type TokenUsage,
} from "./events.js";
import {
  appendStatsEvents,
  readStatsImportIndex,
  writeStatsImportIndex,
  type StatsImportIndex,
} from "./store.js";

export interface ImportCodexStatsOptions {
  readonly cwd?: string;
  readonly codexHome?: string;
  readonly louisgoHome?: string;
  readonly env?: NodeJS.ProcessEnv;
  readonly days?: number;
  readonly dryRun?: boolean;
  readonly now?: () => Date;
}

export interface ImportCodexStatsResult {
  readonly workspaceRoot: string;
  readonly codexHome: string;
  readonly dryRun: boolean;
  readonly scannedFiles: number;
  readonly skippedFiles: number;
  readonly matchedEvents: number;
  readonly importedEvents: number;
  readonly duplicateEvents: number;
}

interface ParsedCodexUsageCandidate {
  readonly timestamp: string;
  readonly usage: TokenUsage;
  readonly sourceLine: number;
  readonly usageKind: CodexStats["usage_kind"];
  readonly sessionId?: string;
}

export async function importCodexStats(
  options: ImportCodexStatsOptions = {},
): Promise<ImportCodexStatsResult> {
  const workspaceRoot = await findGitRoot(options.cwd);
  const now = options.now?.() ?? new Date();
  const codexHome = resolve(options.codexHome ?? join(homedir(), ".codex"));
  const cutoff =
    options.days === undefined ? null : new Date(now.getTime() - options.days * 86_400_000);
  const importIndex = await readStatsImportIndex({
    cwd: workspaceRoot,
    ...(options.louisgoHome === undefined ? {} : { louisgoHome: options.louisgoHome }),
    ...(options.env === undefined ? {} : { env: options.env }),
  });

  if (!(await pathExists(codexHome))) {
    return {
      workspaceRoot,
      codexHome,
      dryRun: options.dryRun === true,
      scannedFiles: 0,
      skippedFiles: 0,
      matchedEvents: 0,
      importedEvents: 0,
      duplicateEvents: 0,
    };
  }

  const files = await listJsonlFiles(codexHome);
  const nextIndex: StatsImportIndex = {
    schema: "louisgo-stats-imports-v1",
    files: { ...importIndex.files },
  };
  const events: StatsEvent[] = [];
  let scannedFiles = 0;
  let skippedFiles = 0;

  for (const filePath of files) {
    const fileStat = await stat(filePath);

    if (cutoff !== null && fileStat.mtime < cutoff) {
      skippedFiles += 1;
      continue;
    }

    const relativeSource = toPosixPath(relative(codexHome, filePath));
    const content = await readFile(filePath, "utf8");
    const sourceFileHash = sha256(content);
    const fingerprint = `${sourceFileHash}:${fileStat.size}:${Math.floor(fileStat.mtimeMs)}`;

    if (nextIndex.files[relativeSource]?.fingerprint === fingerprint) {
      skippedFiles += 1;
      continue;
    }

    scannedFiles += 1;

    const parsed = parseCodexUsageEvents({
      content,
      sourceFile: relativeSource,
      sourceFileHash,
      fallbackTimestamp: fileStat.mtime.toISOString(),
      cutoff,
    });

    events.push(...parsed);
    nextIndex.files[relativeSource] = {
      fingerprint,
      importedAt: now.toISOString(),
      importedEvents: parsed.length,
    };
  }

  if (options.dryRun === true) {
    return {
      workspaceRoot,
      codexHome,
      dryRun: true,
      scannedFiles,
      skippedFiles,
      matchedEvents: events.length,
      importedEvents: 0,
      duplicateEvents: 0,
    };
  }

  const storeOptions = {
    cwd: workspaceRoot,
    ...(options.louisgoHome === undefined ? {} : { louisgoHome: options.louisgoHome }),
    ...(options.env === undefined ? {} : { env: options.env }),
  };
  const appendResult = await appendStatsEvents({ ...storeOptions, events });
  await writeStatsImportIndex({ ...storeOptions, index: nextIndex });

  return {
    workspaceRoot,
    codexHome,
    dryRun: false,
    scannedFiles,
    skippedFiles,
    matchedEvents: events.length,
    importedEvents: appendResult.appended,
    duplicateEvents: appendResult.skipped,
  };
}

export function parseCodexUsageEvents(params: {
  readonly content: string;
  readonly sourceFile: string;
  readonly sourceFileHash: string;
  readonly fallbackTimestamp: string;
  readonly cutoff?: Date | null;
}): readonly StatsEvent[] {
  const events: StatsEvent[] = [];
  const totalCandidates: ParsedCodexUsageCandidate[] = [];
  const lines = params.content.split(/\r?\n/);

  for (const [index, line] of lines.entries()) {
    if (line.trim().length === 0) {
      continue;
    }

    let parsed: unknown;

    try {
      parsed = JSON.parse(line);
    } catch {
      continue;
    }

    const timestamp = findTimestamp(parsed) ?? params.fallbackTimestamp;
    if (
      params.cutoff !== null &&
      params.cutoff !== undefined &&
      new Date(timestamp) < params.cutoff
    ) {
      continue;
    }

    const sessionId = findFirstStringByKey(parsed, "session_id");
    const lastUsages = findUsageByKey(parsed, "last_token_usage");
    const tokenCountUsages = findUsageByKey(parsed, "token_count");

    for (const usage of [...lastUsages, ...tokenCountUsages]) {
      events.push(
        createCodexUsageEvent({
          timestamp,
          usage,
          sourceFile: params.sourceFile,
          sourceFileHash: params.sourceFileHash,
          sourceLine: index,
          usageKind: lastUsages.includes(usage) ? "last_token_usage" : "token_count",
          ...(sessionId === undefined ? {} : { sessionId }),
        }),
      );
    }

    if (lastUsages.length === 0 && tokenCountUsages.length === 0) {
      for (const usage of findUsageByKey(parsed, "total_token_usage")) {
        totalCandidates.push({
          timestamp,
          usage,
          sourceLine: index,
          usageKind: "total_token_usage",
          ...(sessionId === undefined ? {} : { sessionId }),
        });
      }
    }
  }

  if (events.length > 0 || totalCandidates.length === 0) {
    return events;
  }

  const latest = totalCandidates[totalCandidates.length - 1];
  if (latest === undefined) {
    return events;
  }

  return [
    createCodexUsageEvent({
      timestamp: latest.timestamp,
      usage: latest.usage,
      sourceFile: params.sourceFile,
      sourceFileHash: params.sourceFileHash,
      sourceLine: latest.sourceLine,
      usageKind: latest.usageKind,
      ...(latest.sessionId === undefined ? {} : { sessionId: latest.sessionId }),
    }),
  ];
}

async function listJsonlFiles(root: string): Promise<readonly string[]> {
  const files: string[] = [];

  async function visit(directory: string): Promise<void> {
    let entries;

    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch (error) {
      if (isNodeError(error) && (error.code === "ENOENT" || error.code === "EACCES")) {
        return;
      }

      throw error;
    }

    for (const entry of entries) {
      const entryPath = join(directory, entry.name);

      if (entry.isDirectory()) {
        await visit(entryPath);
      } else if (entry.isFile() && entry.name.endsWith(".jsonl")) {
        files.push(entryPath);
      }
    }
  }

  await visit(root);
  return files.sort((left, right) => (left < right ? -1 : left > right ? 1 : 0));
}

function findUsageByKey(value: unknown, key: string): readonly TokenUsage[] {
  const usages: TokenUsage[] = [];

  function visit(current: unknown): void {
    if (current === null || typeof current !== "object") {
      return;
    }

    if (Array.isArray(current)) {
      for (const item of current) {
        visit(item);
      }
      return;
    }

    for (const [entryKey, entryValue] of Object.entries(current)) {
      if (entryKey === key) {
        const usage = parseTokenUsage(entryValue);
        if (usage !== null) {
          usages.push(usage);
        }
      }

      visit(entryValue);
    }
  }

  visit(value);
  return usages;
}

function parseTokenUsage(value: unknown): TokenUsage | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const raw = value as Record<string, unknown>;
  const usage = {
    ...(typeof raw.input_tokens === "number" ? { input_tokens: raw.input_tokens } : {}),
    ...(typeof raw.cached_input_tokens === "number"
      ? { cached_input_tokens: raw.cached_input_tokens }
      : {}),
    ...(typeof raw.output_tokens === "number" ? { output_tokens: raw.output_tokens } : {}),
    ...(typeof raw.reasoning_output_tokens === "number"
      ? { reasoning_output_tokens: raw.reasoning_output_tokens }
      : {}),
    ...(typeof raw.total_tokens === "number" ? { total_tokens: raw.total_tokens } : {}),
  };

  if (Object.keys(usage).length === 0) {
    return null;
  }

  return tokenUsageSchema.parse(usage);
}

function findTimestamp(value: unknown): string | undefined {
  const timestamp = findFirstStringByKey(value, "timestamp") ?? findFirstStringByKey(value, "ts");

  if (timestamp === undefined || Number.isNaN(new Date(timestamp).getTime())) {
    return undefined;
  }

  return new Date(timestamp).toISOString();
}

function findFirstStringByKey(value: unknown, key: string): string | undefined {
  if (value === null || typeof value !== "object") {
    return undefined;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findFirstStringByKey(item, key);
      if (found !== undefined) {
        return found;
      }
    }

    return undefined;
  }

  for (const [entryKey, entryValue] of Object.entries(value)) {
    if (entryKey === key && typeof entryValue === "string" && entryValue.length > 0) {
      return entryValue;
    }

    const found = findFirstStringByKey(entryValue, key);
    if (found !== undefined) {
      return found;
    }
  }

  return undefined;
}

function sha256(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

function toPosixPath(path: string): string {
  return path.split(sep).join("/");
}
