import { pauseTask, readCurrentTask, type TaskSnapshot } from "../store/task-store.js";
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
  readonly taskId?: string;
  readonly message?: string;
}

export interface PauseServiceResult {
  readonly workspaceRoot: string;
  readonly filePath: string;
  readonly status: PauseResultStatus;
  readonly task: TaskSnapshot;
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
      message: "LouisGo protocol is incomplete. Run louisgo init first or fix the protocol files.",
      issues: protocolStatus.issues,
    });
  }

  const existing = await readCurrentTask({
    cwd: protocolStatus.workspaceRoot,
    ...(options.env === undefined ? {} : { env: options.env }),
    ...(options.louisgoHome === undefined ? {} : { louisgoHome: options.louisgoHome }),
    ...(options.taskId === undefined ? {} : { taskId: options.taskId }),
  });
  const task = await pauseTask({
    cwd: protocolStatus.workspaceRoot,
    ...(options.env === undefined ? {} : { env: options.env }),
    ...(options.louisgoHome === undefined ? {} : { louisgoHome: options.louisgoHome }),
    ...(options.taskId === undefined ? {} : { taskId: options.taskId }),
    ...(options.message === undefined ? {} : { message: options.message }),
    ...(options.now === undefined ? {} : { now: options.now }),
  });

  return {
    workspaceRoot: task.projectPaths.workspaceRoot,
    filePath: task.taskPaths.latestCheckpoint,
    status: existing === null ? pauseResultStatuses.created : pauseResultStatuses.updated,
    task,
  };
}
