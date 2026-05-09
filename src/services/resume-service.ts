import {
  checkResumeReadiness,
  createResumePackage,
  readCurrentTask,
  type ResumeReadiness,
  type TaskSnapshot,
} from "../store/task-store.js";
import type { StatusServiceOptions } from "./status-service.js";

export const resumeServiceErrorCodes = {
  noActiveTask: "NO_ACTIVE_TASK",
} as const;

export type ResumeServiceErrorCode =
  (typeof resumeServiceErrorCodes)[keyof typeof resumeServiceErrorCodes];

export interface ResumeServiceOptions extends StatusServiceOptions {
  readonly taskId?: string;
}

export interface ResumeServiceResult {
  readonly workspaceRoot: string;
  readonly task: TaskSnapshot;
  readonly readiness: ResumeReadiness;
  readonly content: string;
}

export class ResumeServiceError extends Error {
  readonly code: ResumeServiceErrorCode;

  constructor(code: ResumeServiceErrorCode, message: string) {
    super(message);
    this.name = "ResumeServiceError";
    this.code = code;
  }
}

export async function resumeLouisGo(
  options: ResumeServiceOptions = {},
): Promise<ResumeServiceResult> {
  const task = await readCurrentTask(options);

  if (task === null) {
    throw new ResumeServiceError(
      resumeServiceErrorCodes.noActiveTask,
      "No private LouisGo task exists yet. Run louisgo pause after starting work.",
    );
  }

  const readiness = await checkResumeReadiness(task);

  return {
    workspaceRoot: task.projectPaths.workspaceRoot,
    task,
    readiness,
    content: createResumePackage(task, readiness),
  };
}
