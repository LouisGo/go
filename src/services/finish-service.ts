import { readFile, rm, writeFile } from "node:fs/promises";

import { runGit } from "../git/git.js";
import { pathExists } from "../internal/utils.js";
import { createProtocolPaths } from "../protocol/paths.js";
import { readFrontMatter } from "../protocol/frontmatter.js";
import {
  createHandoffBody,
  writeHandoff,
  writeHandoffDraft,
  type HandoffBodyInput,
  type WriteHandoffDraftResult,
  type WriteHandoffResult,
} from "../protocol/handoff.js";
import {
  confirmReqFrontMatterSchema,
  missingTaskId,
  quickSaveFrontMatterSchema,
  type VerificationStatus,
} from "../protocol/schemas.js";
import { createStateTemplate } from "../templates/state.js";
import { checkVerificationFreshness, getCurrentGitSnapshot } from "../verify/freshness.js";
import {
  checkProtocolStatus,
  type ProtocolIssue,
  type StatusServiceOptions,
} from "./status-service.js";

export const finishServiceErrorCodes = {
  protocolIncomplete: "PROTOCOL_INCOMPLETE",
} as const;

export type FinishServiceErrorCode =
  (typeof finishServiceErrorCodes)[keyof typeof finishServiceErrorCodes];

export interface FinishServiceOptions extends StatusServiceOptions {
  readonly now?: () => Date;
}

export interface GenerateHandoffDraftResult extends WriteHandoffDraftResult {
  readonly workspaceRoot: string;
  readonly verification: VerificationStatus;
  readonly gitDiffSummary: string;
  readonly blockerSummary: string;
  readonly confirmReqSummary: string;
  readonly confirmReqPresent: boolean;
  readonly quickSaveSummary: string;
  readonly quickSavePresent: boolean;
  readonly adrDrafts: readonly string[];
}

export interface GenerateHandoffSnapshotResult extends WriteHandoffResult {
  readonly workspaceRoot: string;
  readonly verification: VerificationStatus;
  readonly gitDiffSummary: string;
  readonly blockerSummary: string;
  readonly confirmReqSummary: string;
  readonly confirmReqPresent: boolean;
  readonly quickSaveSummary: string;
  readonly quickSavePresent: boolean;
  readonly adrDrafts: readonly string[];
  readonly statePath: string;
}

export const finishCleanupStatuses = {
  absent: "absent",
  cleaned: "cleaned",
} as const;

export type FinishCleanupStatus =
  (typeof finishCleanupStatuses)[keyof typeof finishCleanupStatuses];

export interface FinishServiceResult extends GenerateHandoffSnapshotResult {
  readonly confirmReqCleanup: FinishCleanupStatus;
  readonly quickSaveCleanup: FinishCleanupStatus;
}

export class FinishServiceError extends Error {
  readonly code: FinishServiceErrorCode;
  readonly issues: readonly ProtocolIssue[];

  constructor(params: {
    readonly code: FinishServiceErrorCode;
    readonly message: string;
    readonly issues: readonly ProtocolIssue[];
  }) {
    super(params.message);
    this.name = "FinishServiceError";
    this.code = params.code;
    this.issues = params.issues;
  }
}

export async function generateHandoffDraft(
  options: FinishServiceOptions = {},
): Promise<GenerateHandoffDraftResult> {
  const context = await collectHandoffContext(options);
  const draft = await writeHandoffDraft({
    workspaceRoot: context.workspaceRoot,
    frontMatter: {
      mode: context.mode,
      taskId: context.taskId,
      gitHead: context.snapshot.gitHead,
      diffHash: context.snapshot.diffHash,
      verification: context.verification,
      generatedAt: context.generatedAt,
    },
    body: createHandoffBodyInput(context),
  });

  return {
    workspaceRoot: context.workspaceRoot,
    ...draft,
    verification: context.verification,
    gitDiffSummary: context.gitDiffSummary,
    blockerSummary: context.blockerSummary,
    confirmReqSummary: context.confirmReq.summary,
    confirmReqPresent: context.confirmReq.present,
    quickSaveSummary: context.quickSave.summary,
    quickSavePresent: context.quickSave.present,
    adrDrafts: context.adrDrafts,
  };
}

export async function generateHandoffSnapshot(
  options: FinishServiceOptions = {},
): Promise<GenerateHandoffSnapshotResult> {
  const context = await collectHandoffContext(options);
  const paths = createProtocolPaths(context.workspaceRoot);
  const bodyInput = createHandoffBodyInput(context);
  const body = createHandoffBody(bodyInput);
  const handoff = await writeHandoff({
    workspaceRoot: context.workspaceRoot,
    frontMatter: {
      mode: context.mode,
      taskId: context.taskId,
      gitHead: context.snapshot.gitHead,
      diffHash: context.snapshot.diffHash,
      verification: context.verification,
      generatedAt: context.generatedAt,
      confirmedAt: context.generatedAt,
    },
    body,
  });

  await writeFile(
    paths.state,
    createStateTemplate({
      updatedAt: context.generatedAt,
      mode: context.mode,
      phase: context.phase,
      currentTask: context.taskId,
      verification: context.verification,
      gitHead: context.snapshot.gitHead,
      diffHash: context.snapshot.diffHash,
    }),
    "utf8",
  );

  return {
    workspaceRoot: context.workspaceRoot,
    ...handoff,
    verification: context.verification,
    gitDiffSummary: context.gitDiffSummary,
    blockerSummary: context.blockerSummary,
    confirmReqSummary: context.confirmReq.summary,
    confirmReqPresent: context.confirmReq.present,
    quickSaveSummary: context.quickSave.summary,
    quickSavePresent: context.quickSave.present,
    adrDrafts: context.adrDrafts,
    statePath: paths.state,
  };
}

export async function finishLouisGo(
  options: FinishServiceOptions = {},
): Promise<FinishServiceResult> {
  const snapshot = await generateHandoffSnapshot(options);
  const paths = createProtocolPaths(snapshot.workspaceRoot);

  if (snapshot.confirmReqPresent) {
    await rm(paths.confirmReq, { force: true });
  }

  if (snapshot.quickSavePresent) {
    await rm(paths.quickSave, { force: true });
  }

  return {
    ...snapshot,
    confirmReqCleanup: snapshot.confirmReqPresent
      ? finishCleanupStatuses.cleaned
      : finishCleanupStatuses.absent,
    quickSaveCleanup: snapshot.quickSavePresent
      ? finishCleanupStatuses.cleaned
      : finishCleanupStatuses.absent,
  };
}

interface HandoffContext {
  readonly workspaceRoot: string;
  readonly mode: NonNullable<Awaited<ReturnType<typeof checkProtocolStatus>>["mode"]>;
  readonly phase: string;
  readonly taskId: string;
  readonly snapshot: Awaited<ReturnType<typeof getCurrentGitSnapshot>>;
  readonly verification: VerificationStatus;
  readonly generatedAt: string;
  readonly gitDiffSummary: string;
  readonly blockerSummary: string;
  readonly confirmReq: ProtocolFileSummary;
  readonly quickSave: ProtocolFileSummary;
  readonly adrDrafts: readonly string[];
}

async function collectHandoffContext(options: FinishServiceOptions = {}): Promise<HandoffContext> {
  const protocolStatus = await checkProtocolStatus({
    ...(options.cwd === undefined ? {} : { cwd: options.cwd }),
  });

  if (!protocolStatus.complete || protocolStatus.mode === null) {
    throw new FinishServiceError({
      code: finishServiceErrorCodes.protocolIncomplete,
      message: "LouisGo protocol is incomplete. Run louisgo init first or fix the protocol files.",
      issues: protocolStatus.issues,
    });
  }

  const workspaceRoot = protocolStatus.workspaceRoot;
  const paths = createProtocolPaths(workspaceRoot);
  const snapshot = await getCurrentGitSnapshot({ cwd: workspaceRoot });
  const verification = await readVerificationStatus(workspaceRoot, paths.testResults);
  const gitDiffSummary = await getGitDiffSummary(workspaceRoot);
  const blockerSummary = await readBlockerSummary(paths.blocker);
  const confirmReq = await readConfirmReqSummary(paths.confirmReq);
  const quickSave = await readQuickSaveSummary(paths.quickSave);
  const generatedAt = (options.now?.() ?? new Date()).toISOString();
  const taskId = protocolStatus.currentTask?.id ?? missingTaskId;

  return {
    workspaceRoot,
    mode: protocolStatus.mode,
    phase: protocolStatus.phase,
    taskId,
    snapshot,
    verification,
    generatedAt,
    gitDiffSummary,
    blockerSummary,
    confirmReq,
    quickSave,
    adrDrafts: protocolStatus.adrDrafts,
  };
}

function createHandoffBodyInput(context: HandoffContext): HandoffBodyInput {
  return {
    taskId: context.taskId,
    phase: context.phase,
    verification: context.verification,
    gitDiffSummary: context.gitDiffSummary,
    blockerSummary: context.blockerSummary,
    confirmReqSummary: context.confirmReq.summary,
    quickSaveSummary: context.quickSave.summary,
    adrDrafts: context.adrDrafts,
  };
}

async function readVerificationStatus(
  workspaceRoot: string,
  testResultsPath: string,
): Promise<VerificationStatus> {
  const freshness = await checkVerificationFreshness({
    cwd: workspaceRoot,
    testResultsPath,
  });

  return freshness.status;
}

async function getGitDiffSummary(workspaceRoot: string): Promise<string> {
  const [status, diffStat] = await Promise.all([
    runGit(["status", "--short", "--", ".", ":!.louisgo/RUNLOG.md", ":!.louisgo/stats/**"], {
      cwd: workspaceRoot,
    }),
    runGit(["diff", "--stat", "HEAD", "--", ".", ":!.louisgo/RUNLOG.md", ":!.louisgo/stats/**"], {
      cwd: workspaceRoot,
      allowFailure: true,
    }),
  ]);
  const sections: string[] = [];

  if (status.stdout.trim().length > 0) {
    sections.push(["### Git status", fenced(status.stdout)].join("\n\n"));
  }

  if (diffStat.stdout.trim().length > 0) {
    sections.push(["### Git diff --stat", fenced(diffStat.stdout)].join("\n\n"));
  }

  return sections.length === 0
    ? "No Git diff summary for the current workspace."
    : sections.join("\n\n");
}

async function readBlockerSummary(filePath: string): Promise<string> {
  if (!(await pathExists(filePath))) {
    return "BLOCKER.md was not found.";
  }

  const content = stripTopLevelHeading((await readFile(filePath, "utf8")).trim(), "Blocker");
  return content.length === 0 ? "No blockers." : content;
}

async function readConfirmReqSummary(filePath: string): Promise<ProtocolFileSummary> {
  if (!(await pathExists(filePath))) {
    return {
      present: false,
      summary: "No open confirmation requests.",
    };
  }

  const document = await readFrontMatter(filePath, confirmReqFrontMatterSchema);
  const body = document.body.trim();

  return {
    present: true,
    summary: [
      `Open confirmation request: ${document.frontMatter.taskId}`,
      body.length === 0 ? "CONFIRM_REQ.md body is empty." : body,
    ].join("\n\n"),
  };
}

async function readQuickSaveSummary(filePath: string): Promise<ProtocolFileSummary> {
  if (!(await pathExists(filePath))) {
    return {
      present: false,
      summary: "No Quick Save.",
    };
  }

  const document = await readFrontMatter(filePath, quickSaveFrontMatterSchema);
  const body = document.body.trim();
  const bodySummary = hasMeaningfulProtocolBody(body)
    ? body
    : "QUICK_SAVE.md has no meaningful body.";

  return {
    present: true,
    summary: [
      `Quick Save exists: ${document.frontMatter.taskId}, saved at ${document.frontMatter.savedAt}`,
      bodySummary,
    ].join("\n\n"),
  };
}

interface ProtocolFileSummary {
  readonly present: boolean;
  readonly summary: string;
}

function fenced(content: string): string {
  return `\`\`\`text\n${content.trimEnd()}\n\`\`\``;
}

function stripTopLevelHeading(content: string, title: string): string {
  return content.replace(new RegExp(`^#\\s+${title}\\s*(?:\\r?\\n|$)`), "").trim();
}

function hasMeaningfulProtocolBody(body: string): boolean {
  return body.split(/\r?\n/).some((line) => {
    const trimmed = line.trim();

    return (
      trimmed.length > 0 &&
      !trimmed.startsWith("#") &&
      !trimmed.startsWith("Current task:") &&
      !trimmed.startsWith("The current ROADMAP ")
    );
  });
}
