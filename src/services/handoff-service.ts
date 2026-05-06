import { findGitRoot } from "../fs/workspace.js";
import { isNodeError, pathExists } from "../internal/utils.js";
import { FrontMatterError, readFrontMatter } from "../protocol/frontmatter.js";
import { writeHandoff, type WriteHandoffResult } from "../protocol/handoff.js";
import { createProtocolPaths } from "../protocol/paths.js";
import { handoffFrontMatterSchema } from "../protocol/schemas.js";
import type { StatusServiceOptions } from "./status-service.js";

export const handoffPromoteStatuses = {
  created: "created",
  updated: "updated",
} as const;

export type HandoffPromoteStatus =
  (typeof handoffPromoteStatuses)[keyof typeof handoffPromoteStatuses];

export const handoffServiceErrorCodes = {
  draftMissing: "HANDOFF_DRAFT_MISSING",
  draftInvalid: "HANDOFF_DRAFT_INVALID",
} as const;

export type HandoffServiceErrorCode =
  (typeof handoffServiceErrorCodes)[keyof typeof handoffServiceErrorCodes];

export interface HandoffServiceOptions extends StatusServiceOptions {
  readonly now?: () => Date;
}

export interface PromoteHandoffResult extends WriteHandoffResult {
  readonly workspaceRoot: string;
  readonly draftPath: string;
  readonly status: HandoffPromoteStatus;
}

export class HandoffServiceError extends Error {
  readonly code: HandoffServiceErrorCode;
  readonly filePath: string;
  readonly cause?: unknown;

  constructor(params: {
    readonly code: HandoffServiceErrorCode;
    readonly filePath: string;
    readonly message: string;
    readonly cause?: unknown;
  }) {
    super(params.message);
    this.name = "HandoffServiceError";
    this.code = params.code;
    this.filePath = params.filePath;

    if (params.cause !== undefined) {
      this.cause = params.cause;
    }
  }
}

export async function promoteHandoff(
  options: HandoffServiceOptions = {},
): Promise<PromoteHandoffResult> {
  const workspaceRoot = await findGitRoot(options.cwd);
  const paths = createProtocolPaths(workspaceRoot);
  const document = await readHandoffDraft(paths.handoffDraft);
  const handoffExists = await pathExists(paths.handoff);
  const confirmedAt = (options.now?.() ?? new Date()).toISOString();
  const body = promoteDraftBody(document.body);
  const result = await writeHandoff({
    workspaceRoot,
    frontMatter: {
      mode: document.frontMatter.mode,
      taskId: document.frontMatter.taskId,
      gitHead: document.frontMatter.gitHead,
      diffHash: document.frontMatter.diffHash,
      verification: document.frontMatter.verification,
      generatedAt: document.frontMatter.generatedAt ?? confirmedAt,
      confirmedAt,
    },
    body,
  });

  return {
    workspaceRoot,
    draftPath: paths.handoffDraft,
    status: handoffExists ? handoffPromoteStatuses.updated : handoffPromoteStatuses.created,
    ...result,
  };
}

async function readHandoffDraft(filePath: string) {
  try {
    return await readFrontMatter(filePath, handoffFrontMatterSchema);
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      throw new HandoffServiceError({
        code: handoffServiceErrorCodes.draftMissing,
        filePath,
        message: `HANDOFF_DRAFT.md 不存在：${filePath}`,
        cause: error,
      });
    }

    if (error instanceof FrontMatterError) {
      throw new HandoffServiceError({
        code: handoffServiceErrorCodes.draftInvalid,
        filePath,
        message: `HANDOFF_DRAFT.md 格式非法：${filePath}`,
        cause: error,
      });
    }

    throw error;
  }
}

function promoteDraftBody(body: string): string {
  return body.replace(/^# Handoff Draft(\r?\n)/, "# Handoff$1");
}
