import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import { isNodeError, pathExists } from "../internal/utils.js";
import { resolvePrivateProjectPaths, type PrivateStoreOptions } from "../store/private-paths.js";
import { statsEventSchema, type StatsEvent } from "./events.js";

export interface StatsStoreOptions extends PrivateStoreOptions {}

export interface AppendStatsEventsOptions extends StatsStoreOptions {
  readonly events: readonly StatsEvent[];
}

export interface AppendStatsEventsResult {
  readonly workspaceRoot: string;
  readonly filePath: string;
  readonly appended: number;
  readonly skipped: number;
}

export interface StatsImportFileRecord {
  readonly fingerprint: string;
  readonly importedAt: string;
  readonly importedEvents: number;
}

export interface StatsImportIndex {
  readonly schema: "louisgo-stats-imports-v1";
  readonly files: Record<string, StatsImportFileRecord>;
}

export async function appendStatsEvents(
  options: AppendStatsEventsOptions,
): Promise<AppendStatsEventsResult> {
  const paths = await resolvePrivateProjectPaths(options);
  const workspaceRoot = paths.workspaceRoot;
  const existingIds = new Set((await readStatsEvents(options)).map((event) => event.id));
  const nextEvents = options.events.filter((event) => !existingIds.has(event.id));

  if (nextEvents.length > 0) {
    await mkdir(dirname(paths.statsEvents), { recursive: true });
    const payload = nextEvents.map((event) => `${JSON.stringify(event)}\n`).join("");
    const existing = await readFileIfExists(paths.statsEvents);
    await writeFile(paths.statsEvents, `${existing}${payload}`, "utf8");
  }

  return {
    workspaceRoot,
    filePath: paths.statsEvents,
    appended: nextEvents.length,
    skipped: options.events.length - nextEvents.length,
  };
}

export async function readStatsEvents(
  options: StatsStoreOptions = {},
): Promise<readonly StatsEvent[]> {
  const paths = await resolvePrivateProjectPaths(options);
  const content = await readFileIfExists(paths.statsEvents);

  if (content.length === 0) {
    return [];
  }

  const events: StatsEvent[] = [];

  for (const line of content.split(/\r?\n/)) {
    if (line.trim().length === 0) {
      continue;
    }

    try {
      events.push(statsEventSchema.parse(JSON.parse(line)));
    } catch {
      // Ignore malformed diagnostic lines rather than making stats unusable.
    }
  }

  return events;
}

export async function readStatsImportIndex(
  options: StatsStoreOptions = {},
): Promise<StatsImportIndex> {
  const paths = await resolvePrivateProjectPaths(options);
  const content = await readFileIfExists(paths.statsImports);

  if (content.length === 0) {
    return {
      schema: "louisgo-stats-imports-v1",
      files: {},
    };
  }

  const parsed = JSON.parse(content) as Partial<StatsImportIndex>;

  return {
    schema: "louisgo-stats-imports-v1",
    files: parsed.files ?? {},
  };
}

export async function writeStatsImportIndex(
  options: StatsStoreOptions & { readonly index: StatsImportIndex },
): Promise<void> {
  const paths = await resolvePrivateProjectPaths(options);
  await mkdir(dirname(paths.statsImports), { recursive: true });
  await writeFile(paths.statsImports, `${JSON.stringify(options.index, null, 2)}\n`, "utf8");
}

async function readFileIfExists(filePath: string): Promise<string> {
  if (!(await pathExists(filePath))) {
    return "";
  }

  try {
    return await readFile(filePath, "utf8");
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      return "";
    }

    throw error;
  }
}
