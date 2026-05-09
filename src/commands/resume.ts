import type { Command } from "commander";
import type { Writable } from "node:stream";

import { createOutputTheme, headline, tip } from "../output/theme.js";
import {
  resumeLouisGo,
  ResumeServiceError,
  resumeServiceErrorCodes,
  type ResumeServiceOptions,
} from "../services/resume-service.js";

export interface RegisterResumeCommandOptions extends ResumeServiceOptions {
  readonly stdout?: Writable;
  readonly stderr?: Writable;
  readonly setExitCode?: (exitCode: number) => void;
}

export function registerResumeCommand(
  program: Command,
  options: RegisterResumeCommandOptions = {},
): void {
  program
    .command("resume")
    .description("▶️ Restore a private LouisGo task")
    .option("--task <id>", "Private task id to resume instead of the active task")
    .action(async (commandOptions: { readonly task?: string }) => {
      const stdout = options.stdout ?? process.stdout;
      const stderr = options.stderr ?? process.stderr;
      const setExitCode =
        options.setExitCode ??
        ((exitCode: number) => {
          process.exitCode = exitCode;
        });

      try {
        const result = await resumeLouisGo({
          ...options,
          ...(commandOptions.task === undefined ? {} : { taskId: commandOptions.task }),
        });
        stdout.write(`${result.content}\n`);
        setExitCode(result.readiness.status === "ready" ? 0 : 1);
      } catch (error) {
        if (
          !(error instanceof ResumeServiceError) ||
          error.code !== resumeServiceErrorCodes.noActiveTask
        ) {
          throw error;
        }

        const theme = createOutputTheme(stderr);
        stderr.write(
          `${headline(theme, "✕", "Resume failed")}: ${error.message}\n${tip(
            theme,
            `Run ${theme.command("louisgo pause")} to create the first private checkpoint.`,
          )}\n`,
        );
        setExitCode(1);
      }
    });
}
