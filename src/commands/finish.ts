import type { Command } from "commander";
import type { Writable } from "node:stream";

import {
  finishCleanupStatuses,
  finishLouisGo,
  FinishServiceError,
  finishServiceErrorCodes,
  type FinishCleanupStatus,
  type FinishServiceOptions,
  type FinishServiceResult,
} from "../services/finish-service.js";
import { appendRunLogEvent } from "../services/run-log-service.js";

export interface RegisterFinishCommandOptions extends FinishServiceOptions {
  readonly stdout?: Writable;
  readonly stderr?: Writable;
  readonly setExitCode?: (exitCode: number) => void;
}

export function registerFinishCommand(
  program: Command,
  options: RegisterFinishCommandOptions = {},
): void {
  program
    .command("finish")
    .description("Generate a LouisGo handoff")
    .allowExcessArguments(false)
    .action(async () => {
      const stdout = options.stdout ?? process.stdout;
      const stderr = options.stderr ?? process.stderr;
      const setExitCode =
        options.setExitCode ??
        ((exitCode: number) => {
          process.exitCode = exitCode;
        });

      try {
        const result = await finishLouisGo(options);
        stdout.write(formatFinishReport(result));
        await appendRunLogEvent({
          cwd: result.workspaceRoot,
          command: "finish",
          outcome: "success",
          note: `task=${result.frontMatter.taskId}; verification=${result.verification}; confirm_cleanup=${result.confirmReqCleanup}; quick_save_cleanup=${result.quickSaveCleanup}`,
        }).catch(() => undefined);
        setExitCode(0);
      } catch (error) {
        if (
          !(error instanceof FinishServiceError) ||
          error.code !== finishServiceErrorCodes.protocolIncomplete
        ) {
          throw error;
        }

        stderr.write("Finish failed: LouisGo protocol is incomplete. Run louisgo init first.\n");
        if (error.issues.length > 0) {
          stderr.write("Issues to fix:\n");
          for (const issue of error.issues) {
            stderr.write(`- ${issue.relativePath}: ${issue.message}\n`);
          }
        }
        await appendRunLogEvent({
          ...(options.cwd === undefined ? {} : { cwd: options.cwd }),
          command: "finish",
          outcome: "failure",
          note: "protocol_incomplete",
        }).catch(() => undefined);
        setExitCode(1);
      }
    });
}

function formatFinishReport(result: FinishServiceResult): string {
  return (
    [
      `LouisGo handoff updated: ${result.filePath}`,
      `Current task: ${result.frontMatter.taskId}`,
      `Verification status: ${result.verification}`,
      `Confirm Request: ${formatCleanup(result.confirmReqCleanup)}`,
      `Quick Save: ${formatCleanup(result.quickSaveCleanup)}`,
      `STATE.md: updated (${result.statePath})`,
      "Next: new sessions should prefer HANDOFF.md. Run louisgo verify again after further changes.",
    ].join("\n") + "\n"
  );
}

function formatCleanup(status: FinishCleanupStatus): string {
  switch (status) {
    case finishCleanupStatuses.cleaned:
      return "promoted and cleaned";
    case finishCleanupStatuses.absent:
      return "absent";
  }
}
