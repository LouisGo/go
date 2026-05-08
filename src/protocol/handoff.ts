import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";

import { writeFrontMatter } from "./frontmatter.js";
import { createProtocolPaths } from "./paths.js";
import {
  handoffFrontMatterSchema,
  missingTaskId,
  type HandoffFrontMatter,
  type LouisGoMode,
  type VerificationStatus,
} from "./schemas.js";

export interface HandoffFrontMatterInput {
  readonly mode: LouisGoMode;
  readonly taskId?: string | null;
  readonly gitHead: string;
  readonly diffHash: string;
  readonly verification: VerificationStatus;
  readonly generatedAt: string;
  readonly confirmedAt?: string;
}

export interface HandoffFrontMatterJson {
  readonly schema: "louisgo-handoff-v1";
  readonly mode: LouisGoMode;
  readonly task_id: string;
  readonly git_head: string;
  readonly diff_hash: string;
  readonly verification: VerificationStatus;
  readonly generated_at: string;
  readonly confirmed_at?: string;
}

export interface HandoffDraftBodyInput {
  readonly taskId?: string | null;
  readonly phase?: string;
  readonly verification: VerificationStatus;
  readonly gitDiffSummary: string;
  readonly blockerSummary: string;
  readonly confirmReqSummary: string;
  readonly quickSaveSummary: string;
  readonly adrDrafts: readonly string[];
}

export type HandoffBodyInput = HandoffDraftBodyInput;

export interface WriteHandoffDraftOptions {
  readonly workspaceRoot: string;
  readonly frontMatter: HandoffFrontMatterInput;
  readonly body: HandoffDraftBodyInput;
}

export interface WriteHandoffDraftResult {
  readonly filePath: string;
  readonly frontMatter: HandoffFrontMatter;
  readonly body: string;
}

export interface WriteHandoffOptions {
  readonly workspaceRoot: string;
  readonly frontMatter: HandoffFrontMatterInput;
  readonly body: string;
}

export interface WriteHandoffResult {
  readonly filePath: string;
  readonly frontMatter: HandoffFrontMatter;
  readonly body: string;
}

export async function writeHandoffDraft(
  options: WriteHandoffDraftOptions,
): Promise<WriteHandoffDraftResult> {
  const paths = createProtocolPaths(options.workspaceRoot);
  const frontMatter = serializeHandoffFrontMatter(options.frontMatter);
  const body = createHandoffDraftBody(options.body);

  await mkdir(dirname(paths.handoffDraft), { recursive: true });
  await writeFrontMatter(paths.handoffDraft, { ...frontMatter }, body, handoffFrontMatterSchema);

  return {
    filePath: paths.handoffDraft,
    frontMatter: handoffFrontMatterSchema.parse(frontMatter),
    body,
  };
}

export async function writeHandoff(options: WriteHandoffOptions): Promise<WriteHandoffResult> {
  const paths = createProtocolPaths(options.workspaceRoot);
  const frontMatter = serializeHandoffFrontMatter(options.frontMatter);

  await mkdir(dirname(paths.handoff), { recursive: true });
  await writeFrontMatter(paths.handoff, { ...frontMatter }, options.body, handoffFrontMatterSchema);

  return {
    filePath: paths.handoff,
    frontMatter: handoffFrontMatterSchema.parse(frontMatter),
    body: options.body,
  };
}

export function serializeHandoffFrontMatter(
  input: HandoffFrontMatterInput,
): HandoffFrontMatterJson {
  return {
    schema: "louisgo-handoff-v1",
    mode: input.mode,
    task_id: normalizeTaskReference(input.taskId),
    git_head: input.gitHead,
    diff_hash: input.diffHash,
    verification: input.verification,
    generated_at: input.generatedAt,
    ...(input.confirmedAt === undefined ? {} : { confirmed_at: input.confirmedAt }),
  };
}

export function createHandoffDraftBody(input: HandoffDraftBodyInput): string {
  return createHandoffDocumentBody("Handoff Draft", input);
}

export function createHandoffBody(input: HandoffBodyInput): string {
  return createHandoffDocumentBody("Handoff", input);
}

function createHandoffDocumentBody(
  title: "Handoff" | "Handoff Draft",
  input: HandoffBodyInput,
): string {
  const taskLine =
    input.taskId === undefined || input.taskId === null
      ? `The current ROADMAP has no available task; task_id uses ${missingTaskId} as a placeholder.`
      : `Current task: ${input.taskId}`;
  const phaseLine = input.phase !== undefined ? `- Phase: ${input.phase}` : null;
  const adrDraftSummary =
    input.adrDrafts.length === 0
      ? "No ADR drafts."
      : input.adrDrafts.map((draft) => `- ${draft}`).join("\n");

  return `# ${title}

## Handoff Summary

- ${taskLine}
${phaseLine !== null ? `${phaseLine}\n` : ""}- Verification status: ${input.verification}
- Handoff judgment: ${formatVerificationHandoffGuidance(input.verification)}

## Recovery Advice

- If there is an open confirmation request, handle it first.
- If there is an ADR draft, confirm whether to continue that decision.
- If you continue changing code, run \`louisgo verify\` when you are done.

## Current Workspace

${input.gitDiffSummary}

## Verification

- Status: ${input.verification}
- Action: ${formatVerificationNextAction(input.verification)}

## Open Items

### Blockers

${input.blockerSummary}

### Open Confirmation Requests

${input.confirmReqSummary}

### ADR Drafts

${adrDraftSummary}

## Recovery Context

### Quick Save

${input.quickSaveSummary}
`;
}

function normalizeTaskReference(taskId?: string | null): string {
  return taskId === undefined || taskId === null || taskId.length === 0 ? missingTaskId : taskId;
}

function formatVerificationHandoffGuidance(status: VerificationStatus): string {
  switch (status) {
    case "passed":
      return "Verification passed and matches the current workspace, so the current diff can be handed off.";
    case "failed":
      return "Verification failed; the next agent should inspect and fix the failure first.";
    case "error":
      return "Verification errored; the next agent should fix the verification entry or runtime environment first.";
    case "skipped":
      return "Verification was skipped and cannot be treated as a quality gate.";
    case "missing":
      return "No verification result is available; run verification before handing off.";
    case "stale":
      return "The verification result is stale and does not represent the current workspace.";
  }
}

function formatVerificationNextAction(status: VerificationStatus): string {
  switch (status) {
    case "passed":
      return "If you change code or protocol files later, rerun `louisgo verify`.";
    case "failed":
      return "Fix the failure first, then rerun `louisgo verify`. Do not treat failed as done.";
    case "error":
      return "Fix the verification entry, dependencies, or runtime environment before rerunning `louisgo verify`.";
    case "skipped":
      return "Configure a real verification command for the project, or maintain project verification scripts and rerun verification.";
    case "missing":
      return "Run `louisgo verify` to generate a verification result for the current workspace.";
    case "stale":
      return "Run `louisgo verify` to refresh the result and confirm whether the workspace is still handoff-ready.";
  }
}
