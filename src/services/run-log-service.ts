import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import { findGitRoot } from "../fs/workspace.js";
import { isNodeError, pathExists } from "../internal/utils.js";
import { createProtocolPaths, protocolRelativePaths } from "../protocol/paths.js";
import {
  defaultRunLogMaxEvents,
  createRunLogTemplate,
  runLogEventsMarker,
} from "../templates/run-log.js";

export interface RunLogServiceOptions {
  readonly cwd?: string;
}

export type RunLogOutcome = "success" | "failure" | "info";

export interface AppendRunLogEventOptions extends RunLogServiceOptions {
  readonly command: string;
  readonly outcome: RunLogOutcome;
  readonly note?: string;
  readonly now?: () => Date;
}

export interface ReadRunLogOptions extends RunLogServiceOptions {
  readonly tailEvents?: number;
}

export interface ReadRunLogResult {
  readonly workspaceRoot: string;
  readonly filePath: string;
  readonly relativePath: string;
  readonly content: string;
  readonly eventCount: number;
}

interface ParsedRunLog {
  readonly head: string;
  readonly events: readonly string[];
}

export async function appendRunLogEvent(
  options: AppendRunLogEventOptions,
): Promise<ReadRunLogResult> {
  const workspaceRoot = await findGitRoot(options.cwd);
  const paths = createProtocolPaths(workspaceRoot);
  const timestamp = (options.now?.() ?? new Date()).toISOString();
  const existing = await readOrCreateRunLog(paths.runLog, timestamp);
  const parsed = parseRunLog(existing);
  const event = createRunLogEvent(timestamp, options.command, options.outcome, options.note);
  const events = [event, ...parsed.events].slice(0, defaultRunLogMaxEvents);
  const content = formatRunLog(parsed.head, events, timestamp);

  await writeFile(paths.runLog, content, "utf8");

  return {
    workspaceRoot,
    filePath: paths.runLog,
    relativePath: protocolRelativePaths.runLog,
    content,
    eventCount: events.length,
  };
}

export async function readRunLog(
  options: ReadRunLogOptions = {},
): Promise<ReadRunLogResult | null> {
  const workspaceRoot = await findGitRoot(options.cwd);
  const paths = createProtocolPaths(workspaceRoot);

  if (!(await pathExists(paths.runLog))) {
    return null;
  }

  const content = await readFile(paths.runLog, "utf8");
  const parsed = parseRunLog(content);
  const events =
    options.tailEvents === undefined
      ? parsed.events
      : parsed.events.slice(0, Math.max(0, Math.floor(options.tailEvents)));
  const output =
    options.tailEvents === undefined ? content : formatRunLog(parsed.head, events, null);

  return {
    workspaceRoot,
    filePath: paths.runLog,
    relativePath: protocolRelativePaths.runLog,
    content: output,
    eventCount: events.length,
  };
}

async function readOrCreateRunLog(filePath: string, timestamp: string): Promise<string> {
  try {
    return await readFile(filePath, "utf8");
  } catch (error) {
    if (!isNodeError(error) || error.code !== "ENOENT") {
      throw error;
    }

    await mkdir(dirname(filePath), { recursive: true });
    return createRunLogTemplate({ updatedAt: timestamp });
  }
}

function createRunLogEvent(
  timestamp: string,
  command: string,
  outcome: RunLogOutcome,
  note?: string,
): string {
  const sanitizedNote = note?.trim();

  return [
    `### ${timestamp} ${command}`,
    "",
    `- outcome: ${outcome}`,
    ...(sanitizedNote === undefined || sanitizedNote.length === 0
      ? []
      : [`- note: ${sanitizedNote.replace(/\s+/g, " ").slice(0, 240)}`]),
  ].join("\n");
}

function parseRunLog(content: string): ParsedRunLog {
  const markerIndex = content.indexOf(runLogEventsMarker);

  if (markerIndex === -1) {
    return {
      head: createRunLogTemplate({ updatedAt: new Date(0).toISOString() }).split(
        runLogEventsMarker,
      )[0]!,
      events: splitEvents(content),
    };
  }

  const head = content.slice(0, markerIndex);
  const tail = content.slice(markerIndex + runLogEventsMarker.length);

  return {
    head,
    events: splitEvents(tail),
  };
}

function splitEvents(content: string): readonly string[] {
  return content
    .split(/\n(?=### \d{4}-\d{2}-\d{2}T)/)
    .map((event) => event.trim())
    .filter((event) => event.startsWith("### "));
}

function formatRunLog(head: string, events: readonly string[], updatedAt: string | null): string {
  const nextHead =
    updatedAt === null ? head : head.replace(/updated_at: ".*"/, `updated_at: "${updatedAt}"`);
  const eventText = events.length === 0 ? "" : `\n\n${events.join("\n\n")}`;

  return `${nextHead.trimEnd()}\n${runLogEventsMarker}${eventText}\n`;
}
