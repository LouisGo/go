import { access, readFile, rm } from "node:fs/promises";

import { runGit } from "../git/git.js";
import { createProtocolPaths } from "../protocol/paths.js";
import { readFrontMatter } from "../protocol/frontmatter.js";
import { writeHandoffDraft, type WriteHandoffDraftResult } from "../protocol/handoff.js";
import {
  confirmReqFrontMatterSchema,
  missingTaskId,
  quickSaveFrontMatterSchema,
  type VerificationStatus,
} from "../protocol/schemas.js";
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

export const finishCleanupStatuses = {
  absent: "absent",
  cleaned: "cleaned",
} as const;

export type FinishCleanupStatus =
  (typeof finishCleanupStatuses)[keyof typeof finishCleanupStatuses];

export interface FinishServiceResult extends GenerateHandoffDraftResult {
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
  const protocolStatus = await checkProtocolStatus({
    ...(options.cwd === undefined ? {} : { cwd: options.cwd }),
  });

  if (!protocolStatus.complete || protocolStatus.mode === null) {
    throw new FinishServiceError({
      code: finishServiceErrorCodes.protocolIncomplete,
      message: "LouisGo 协议不完整，请先运行 louisgo init 或修复协议文件。",
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
  const draft = await writeHandoffDraft({
    workspaceRoot,
    frontMatter: {
      mode: protocolStatus.mode,
      taskId,
      gitHead: snapshot.gitHead,
      diffHash: snapshot.diffHash,
      verification,
      generatedAt,
    },
    body: {
      taskId,
      verification,
      gitDiffSummary,
      blockerSummary,
      confirmReqSummary: confirmReq.summary,
      quickSaveSummary: quickSave.summary,
      adrDrafts: protocolStatus.adrDrafts,
    },
  });

  return {
    workspaceRoot,
    ...draft,
    verification,
    gitDiffSummary,
    blockerSummary,
    confirmReqSummary: confirmReq.summary,
    confirmReqPresent: confirmReq.present,
    quickSaveSummary: quickSave.summary,
    quickSavePresent: quickSave.present,
    adrDrafts: protocolStatus.adrDrafts,
  };
}

export async function finishLouisGo(
  options: FinishServiceOptions = {},
): Promise<FinishServiceResult> {
  const draft = await generateHandoffDraft(options);
  const paths = createProtocolPaths(draft.workspaceRoot);

  if (draft.confirmReqPresent) {
    await rm(paths.confirmReq, { force: true });
  }

  if (draft.quickSavePresent) {
    await rm(paths.quickSave, { force: true });
  }

  return {
    ...draft,
    confirmReqCleanup: draft.confirmReqPresent
      ? finishCleanupStatuses.cleaned
      : finishCleanupStatuses.absent,
    quickSaveCleanup: draft.quickSavePresent
      ? finishCleanupStatuses.cleaned
      : finishCleanupStatuses.absent,
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
    runGit(["status", "--short"], { cwd: workspaceRoot }),
    runGit(["diff", "--stat", "HEAD", "--"], { cwd: workspaceRoot, allowFailure: true }),
  ]);
  const sections: string[] = [];

  if (status.stdout.trim().length > 0) {
    sections.push(["### Git status", fenced(status.stdout)].join("\n\n"));
  }

  if (diffStat.stdout.trim().length > 0) {
    sections.push(["### Git diff --stat", fenced(diffStat.stdout)].join("\n\n"));
  }

  return sections.length === 0 ? "当前工作区无 Git diff 摘要。" : sections.join("\n\n");
}

async function readBlockerSummary(filePath: string): Promise<string> {
  if (!(await pathExists(filePath))) {
    return "未找到 BLOCKER.md。";
  }

  const content = stripTopLevelHeading((await readFile(filePath, "utf8")).trim(), "Blocker");
  return content.length === 0 ? "无 Blocker。" : content;
}

async function readConfirmReqSummary(filePath: string): Promise<ProtocolFileSummary> {
  if (!(await pathExists(filePath))) {
    return {
      present: false,
      summary: "无未解决确认请求。",
    };
  }

  const document = await readFrontMatter(filePath, confirmReqFrontMatterSchema);
  const body = document.body.trim();

  return {
    present: true,
    summary: [
      `存在未解决确认请求：${document.frontMatter.taskId}`,
      body.length === 0 ? "CONFIRM_REQ.md 正文为空。" : body,
    ].join("\n\n"),
  };
}

async function readQuickSaveSummary(filePath: string): Promise<ProtocolFileSummary> {
  if (!(await pathExists(filePath))) {
    return {
      present: false,
      summary: "无 Quick Save。",
    };
  }

  const document = await readFrontMatter(filePath, quickSaveFrontMatterSchema);
  const body = document.body.trim();
  const bodySummary = hasMeaningfulProtocolBody(body) ? body : "QUICK_SAVE.md 没有填写具体正文。";

  return {
    present: true,
    summary: [
      `存在 Quick Save：${document.frontMatter.taskId}，保存时间 ${document.frontMatter.savedAt}`,
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
      !trimmed.startsWith("当前任务：") &&
      !trimmed.startsWith("当前 ROADMAP ")
    );
  });
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}
