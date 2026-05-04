import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import { isNodeError } from "../internal/utils.js";

export const safeWriteStatuses = {
  created: "created",
  skipped: "skipped",
} as const;

export const safeWriteErrorCodes = {
  writeFailed: "WRITE_FAILED",
} as const;

export type SafeWriteStatus = (typeof safeWriteStatuses)[keyof typeof safeWriteStatuses];
export type SafeWriteErrorCode = (typeof safeWriteErrorCodes)[keyof typeof safeWriteErrorCodes];

export interface SafeWriteCreated {
  readonly status: typeof safeWriteStatuses.created;
  readonly filePath: string;
}

export interface SafeWriteSkipped {
  readonly status: typeof safeWriteStatuses.skipped;
  readonly filePath: string;
  readonly reason: "exists";
}

export type SafeWriteResult = SafeWriteCreated | SafeWriteSkipped;

export class SafeWriteError extends Error {
  readonly code: SafeWriteErrorCode;
  readonly filePath: string;
  readonly cause?: unknown;

  constructor(params: {
    readonly code: SafeWriteErrorCode;
    readonly filePath: string;
    readonly message: string;
    readonly cause?: unknown;
  }) {
    super(params.message);
    this.name = "SafeWriteError";
    this.code = params.code;
    this.filePath = params.filePath;

    if (params.cause !== undefined) {
      this.cause = params.cause;
    }
  }
}

export interface SafeWriteOptions {
  readonly mode?: number;
}

export async function safeWriteFile(
  filePath: string,
  content: string | Uint8Array,
  options: SafeWriteOptions = {},
): Promise<SafeWriteResult> {
  const resolvedPath = resolve(filePath);

  try {
    await mkdir(dirname(resolvedPath), { recursive: true });
  } catch (error) {
    throw createWriteFailedError(resolvedPath, error);
  }

  try {
    await writeFile(resolvedPath, content, {
      flag: "wx",
      ...(options.mode === undefined ? {} : { mode: options.mode }),
    });

    return {
      status: safeWriteStatuses.created,
      filePath: resolvedPath,
    };
  } catch (error) {
    if (isNodeError(error) && error.code === "EEXIST") {
      return {
        status: safeWriteStatuses.skipped,
        filePath: resolvedPath,
        reason: "exists",
      };
    }

    throw createWriteFailedError(resolvedPath, error);
  }
}

function createWriteFailedError(filePath: string, cause: unknown): SafeWriteError {
  return new SafeWriteError({
    code: safeWriteErrorCodes.writeFailed,
    filePath,
    message: `文件写入失败：${filePath}`,
    cause,
  });
}

