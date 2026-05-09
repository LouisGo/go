import type { Command } from "commander";
import type { Writable } from "node:stream";

import {
  pauseLouisGo,
  PauseServiceError,
  pauseServiceErrorCodes,
  type PauseServiceOptions,
  type PauseServiceResult,
} from "../services/pause-service.js";
import { createOutputTheme, field, headline, tip } from "../output/theme.js";

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
    .description("⏸️ Write a private LouisGo task checkpoint")
    .option("--task <id>", "Private task id to update instead of the active task")
    .option("--message <text>", "Short checkpoint message")
    .allowExcessArguments(false)
    .action(async (commandOptions: { readonly task?: string; readonly message?: string }) => {
      const stdout = options.stdout ?? process.stdout;
      const stderr = options.stderr ?? process.stderr;
      const setExitCode =
        options.setExitCode ??
        ((exitCode: number) => {
          process.exitCode = exitCode;
        });

      try {
        const result = await pauseLouisGo({
          ...options,
          ...(commandOptions.task === undefined ? {} : { taskId: commandOptions.task }),
          ...(commandOptions.message === undefined ? {} : { message: commandOptions.message }),
        });
        stdout.write(formatPauseReport(result, stdout));
        setExitCode(0);
      } catch (error) {
        if (
          !(error instanceof PauseServiceError) ||
          error.code !== pauseServiceErrorCodes.protocolIncomplete
        ) {
          throw error;
        }

        const theme = createOutputTheme(stderr);
        stderr.write(
          `${headline(theme, "✕", "Pause failed")}: LouisGo protocol is incomplete. Run ${theme.command("louisgo init")} first.\n`,
        );
        if (error.issues.length > 0) {
          stderr.write(`${theme.danger("Issues to fix")}:\n`);
          for (const issue of error.issues) {
            stderr.write(`  ✕ ${theme.path(issue.relativePath)}: ${issue.message}\n`);
          }
        }
        setExitCode(1);
      }
    });
}

function formatPauseReport(result: PauseServiceResult, stdout?: Writable): string {
  const theme = createOutputTheme(stdout);
  const action = result.status === "created" ? "created" : "updated";

  return (
    [
      headline(theme, "⏸️", `LouisGo private checkpoint ${action}`, result.filePath),
      field(theme, "Current task", result.task.meta.task_id),
      field(theme, "Git HEAD", result.task.meta.current_head),
      field(theme, "diff_hash", result.task.meta.diff_hash),
      tip(
        theme,
        `Run ${theme.command("louisgo resume")} to restore this private task in a new session.`,
      ),
    ].join("\n") + "\n"
  );
}
