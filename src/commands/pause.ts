import type { Command } from "commander";
import type { Writable } from "node:stream";

import {
  pauseLouisGo,
  PauseServiceError,
  pauseServiceErrorCodes,
  type PauseServiceOptions,
  type PauseServiceResult,
} from "../services/pause-service.js";

export interface RegisterPauseCommandOptions extends PauseServiceOptions {
  readonly stdout?: Writable;
  readonly stderr?: Writable;
  readonly setExitCode?: (exitCode: number) => void;
}

export function registerPauseCommand(
  program: Command,
  options: RegisterPauseCommandOptions = {},
): void {
  program
    .command("pause")
    .description("Write a LouisGo quick-save checkpoint")
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
        const result = await pauseLouisGo(options);
        stdout.write(formatPauseReport(result));
        setExitCode(0);
      } catch (error) {
        if (
          !(error instanceof PauseServiceError) ||
          error.code !== pauseServiceErrorCodes.protocolIncomplete
        ) {
          throw error;
        }

        stderr.write("Pause failed: LouisGo protocol is incomplete. Run louisgo init first.\n");
        if (error.issues.length > 0) {
          stderr.write("Issues to fix:\n");
          for (const issue of error.issues) {
            stderr.write(`- ${issue.relativePath}: ${issue.message}\n`);
          }
        }
        setExitCode(1);
      }
    });
}

function formatPauseReport(result: PauseServiceResult): string {
  const action = result.status === "created" ? "created" : "updated";

  return (
    [
      `LouisGo quick save ${action}: ${result.filePath}`,
      `Current task: ${result.frontMatter.taskId}`,
      `Git HEAD: ${result.frontMatter.gitHead}`,
      `diff_hash: ${result.frontMatter.diffHash}`,
      "Next: run louisgo status to inspect protocol state before resuming.",
    ].join("\n") + "\n"
  );
}
