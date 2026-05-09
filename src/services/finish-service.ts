import { finishTask, type TaskSnapshot } from "../store/task-store.js";
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

export interface FinishServiceResult {
  readonly workspaceRoot: string;
  readonly filePath: string;
  readonly task: TaskSnapshot;
  readonly verification: "passed" | "failed" | "error" | "skipped" | "missing";
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

export async function finishLouisGo(
  options: FinishServiceOptions = {},
): Promise<FinishServiceResult> {
  const protocolStatus = await checkProtocolStatus({
    ...(options.cwd === undefined ? {} : { cwd: options.cwd }),
    ...(options.env === undefined ? {} : { env: options.env }),
    ...(options.louisgoHome === undefined ? {} : { louisgoHome: options.louisgoHome }),
  });

  if (!protocolStatus.complete || protocolStatus.mode === null) {
    throw new FinishServiceError({
      code: finishServiceErrorCodes.protocolIncomplete,
      message:
        "LouisGo project anchor is incomplete. Run louisgo init first or fix the anchor files.",
      issues: protocolStatus.issues,
    });
  }

  const task = await finishTask(options);

  return {
    workspaceRoot: task.projectPaths.workspaceRoot,
    filePath: task.taskPaths.finish,
    task,
    verification: task.verification?.status ?? "missing",
  };
}
