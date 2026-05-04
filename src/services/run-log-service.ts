import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import { createProtocolPaths, protocolRelativePaths } from "../protocol/paths.js";
import {
  defaultRunLogMaxEvents,
  createRunLogTemplate,
  runLogEventsMarker,
} from "../templates/run-log.js";
import { checkProtocolStatus, type ProtocolStatus } from "./status-service.js";

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
  const status = await checkProtocolStatus({
    ...(options.cwd === undefined ? {} : { cwd: options.cwd }),
  });
  const paths = createProtocolPaths(status.workspaceRoot);
  const timestamp = (options.now?.() ?? new Date()).toISOString();
  const existing = await readOrCreateRunLog(paths.runLog, timestamp);
  const parsed = parseRunLog(existing);
  const event = createRunLogEvent({
    timestamp,
    status,
    command: options.command,
    outcome: options.outcome,
    ...(options.note === undefined ? {} : { note: options.note }),
  });
  const events = [event, ...parsed.events].slice(0, defaultRunLogMaxEvents);
  const content = formatRunLog(parsed.head, events, timestamp);

  await writeFile(paths.runLog, content, "utf8");

  return {
    workspaceRoot: status.workspaceRoot,
    filePath: paths.runLog,
    relativePath: protocolRelativePaths.runLog,
    content,
    eventCount: events.length,
  };
}

export async function readRunLog(
  options: ReadRunLogOptions = {},
): Promise<ReadRunLogResult | null> {
  const status = await checkProtocolStatus({
    ...(options.cwd === undefined ? {} : { cwd: options.cwd }),
  });
  const paths = createProtocolPaths(status.workspaceRoot);

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
    workspaceRoot: status.workspaceRoot,
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

function createRunLogEvent(params: {
  readonly timestamp: string;
  readonly status: ProtocolStatus;
  readonly command: string;
  readonly outcome: RunLogOutcome;
  readonly note?: string;
}): string {
  const note = params.note?.trim();

  return [
    `### ${params.timestamp} ${params.command}`,
    "",
    `- outcome: ${params.outcome}`,
    `- mode: ${params.status.mode ?? "unknown"}`,
    `- task: ${params.status.currentTask?.id ?? "none"}`,
    `- verification: ${params.status.verificationStatus}`,
    `- recovery: ${formatRecoverySource(params.status.recoverySource)}`,
    `- workspace: ${formatWorkspace(params.status)}`,
    `- confirm_req: ${params.status.hasConfirmReq ? "yes" : "no"}`,
    `- adr_drafts: ${params.status.adrDrafts.length}`,
    ...(note === undefined || note.length === 0 ? [] : [`- note: ${sanitizeNote(note)}`]),
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

function formatWorkspace(status: ProtocolStatus): string {
  if (status.workspace.clean) {
    return "clean";
  }

  return `${status.workspace.changedFiles} changed, ${status.workspace.untrackedFiles} untracked`;
}

function formatRecoverySource(source: ProtocolStatus["recoverySource"]): string {
  switch (source) {
    case "handoff":
      return "HANDOFF";
    case "state":
      return "STATE";
    case "quick_save":
      return "QUICK_SAVE";
    case "none":
      return "none";
  }
}

function sanitizeNote(note: string): string {
  return note.replace(/\s+/g, " ").slice(0, 240);
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
