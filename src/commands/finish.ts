import type { Command } from "commander";
import type { Writable } from "node:stream";

import {
  finishLouisGo,
  FinishServiceError,
  finishServiceErrorCodes,
  type FinishServiceOptions,
  type FinishServiceResult,
} from "../services/finish-service.js";
import { appendRunLogEvent } from "../services/run-log-service.js";
import { createOutputTheme, field, headline, statusToken, tip } from "../output/theme.js";

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
    .description("🏁 Finish the active private LouisGo task phase")
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
        stdout.write(formatFinishReport(result, stdout));
        await appendRunLogEvent({
          cwd: result.workspaceRoot,
          command: "finish",
          outcome: "success",
          note: `task=${result.task.meta.task_id}; verification=${result.verification}`,
        }).catch(() => undefined);
        setExitCode(0);
      } catch (error) {
        if (
          !(error instanceof FinishServiceError) ||
          error.code !== finishServiceErrorCodes.protocolIncomplete
        ) {
          throw error;
        }

        const theme = createOutputTheme(stderr);
        stderr.write(
          `${headline(theme, "✕", "Finish failed")}: LouisGo protocol is incomplete. Run ${theme.command("louisgo init")} first.\n`,
        );
        if (error.issues.length > 0) {
          stderr.write(`${theme.danger("Issues to fix")}:\n`);
          for (const issue of error.issues) {
            stderr.write(`  ✕ ${theme.path(issue.relativePath)}: ${issue.message}\n`);
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

function formatFinishReport(result: FinishServiceResult, stdout?: Writable): string {
  const theme = createOutputTheme(stdout);
  return (
    [
      headline(theme, "🏁", "LouisGo private finish updated", result.filePath),
      field(theme, "Current task", result.task.meta.task_id),
      field(theme, "Verification status", statusToken(theme, result.verification)),
      field(
        theme,
        "Task state",
        `${statusToken(theme, "updated")} (${theme.path(result.task.taskPaths.state)})`,
      ),
      tip(
        theme,
        `Task phase finished in the private store. Run ${theme.command("louisgo verify")} again after further changes.`,
      ),
    ].join("\n") + "\n"
  );
}
