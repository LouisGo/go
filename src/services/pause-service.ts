import { pathExists } from "../internal/utils.js";

import { createProtocolPaths } from "../protocol/paths.js";
import { writeQuickSave } from "../protocol/quick-save.js";
import type { QuickSaveFrontMatter } from "../protocol/schemas.js";
import {
  checkProtocolStatus,
  type ProtocolIssue,
  type StatusServiceOptions,
} from "./status-service.js";

export const pauseResultStatuses = {
  created: "created",
  updated: "updated",
} as const;

export const pauseServiceErrorCodes = {
  protocolIncomplete: "PROTOCOL_INCOMPLETE",
} as const;

export type PauseResultStatus = (typeof pauseResultStatuses)[keyof typeof pauseResultStatuses];
export type PauseServiceErrorCode =
  (typeof pauseServiceErrorCodes)[keyof typeof pauseServiceErrorCodes];

export interface PauseServiceOptions extends StatusServiceOptions {
  readonly now?: () => Date;
}

export interface PauseServiceResult {
  readonly workspaceRoot: string;
  readonly filePath: string;
  readonly status: PauseResultStatus;
  readonly frontMatter: QuickSaveFrontMatter;
}

export class PauseServiceError extends Error {
  readonly code: PauseServiceErrorCode;
  readonly issues: readonly ProtocolIssue[];

  constructor(params: {
    readonly code: PauseServiceErrorCode;
    readonly message: string;
    readonly issues: readonly ProtocolIssue[];
  }) {
    super(params.message);
    this.name = "PauseServiceError";
    this.code = params.code;
    this.issues = params.issues;
  }
}

export async function pauseLouisGo(options: PauseServiceOptions = {}): Promise<PauseServiceResult> {
  const protocolStatus = await checkProtocolStatus({
    ...(options.cwd === undefined ? {} : { cwd: options.cwd }),
  });

  if (!protocolStatus.complete || protocolStatus.mode === null) {
    throw new PauseServiceError({
      code: pauseServiceErrorCodes.protocolIncomplete,
      message: "LouisGo 协议不完整，请先运行 louisgo init 或修复协议文件。",
      issues: protocolStatus.issues,
    });
  }

  const paths = createProtocolPaths(protocolStatus.workspaceRoot);
  const quickSaveExists = await pathExists(paths.quickSave);
  const result = await writeQuickSave({
    cwd: protocolStatus.workspaceRoot,
    mode: protocolStatus.mode,
    taskId: protocolStatus.currentTask?.id ?? null,
    ...(options.now === undefined ? {} : { now: options.now }),
  });

  return {
    workspaceRoot: result.workspaceRoot,
    filePath: result.filePath,
    status: quickSaveExists ? pauseResultStatuses.updated : pauseResultStatuses.created,
    frontMatter: result.frontMatter,
  };
}

