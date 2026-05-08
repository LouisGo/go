import type { Command } from "commander";
import type { Writable } from "node:stream";

import {
  contextServiceErrorCodes,
  ContextServiceError,
  generateContext,
  type ContextServiceOptions,
} from "../services/context-service.js";
import { appendRunLogEvent } from "../services/run-log-service.js";
import { createContextStatsEvent } from "../stats/events.js";
import { appendStatsEvents } from "../stats/store.js";

export interface RegisterContextCommandOptions extends ContextServiceOptions {
  readonly now?: () => Date;
  readonly stdout?: Writable;
  readonly stderr?: Writable;
  readonly setExitCode?: (exitCode: number) => void;
}

export function registerContextCommand(
  program: Command,
  options: RegisterContextCommandOptions = {},
): void {
  program
    .command("context")
    .description("Generate a LouisGo prompt context package")
    .option("--budget <tokens>", "Context budget in estimated tokens", parseBudget)
    .option("--goal <text>", "Current goal for the context package or subagent capsule")
    .option("--capsule", "Generate a subagent context capsule with title and constraints")
    .action(async (commandOptions: ContextCommandOptions) => {
      const stdout = options.stdout ?? process.stdout;
      const stderr = options.stderr ?? process.stderr;
      const setExitCode =
        options.setExitCode ??
        ((exitCode: number) => {
          process.exitCode = exitCode;
        });

      try {
        const result = await generateContext({
          ...(options.cwd === undefined ? {} : { cwd: options.cwd }),
          ...(commandOptions.budget === undefined ? {} : { budgetTokens: commandOptions.budget }),
          ...(commandOptions.goal === undefined ? {} : { goal: commandOptions.goal }),
          ...(commandOptions.capsule === undefined ? {} : { capsule: commandOptions.capsule }),
        });

        stdout.write(result.content);
        stdout.write("\n");
        await appendStatsEvents({
          cwd: result.workspaceRoot,
          events: [
            createContextStatsEvent({
              timestamp: (options.now?.() ?? new Date()).toISOString(),
              context: result.stats,
            }),
          ],
        }).catch(() => undefined);
        await appendRunLogEvent({
          cwd: result.workspaceRoot,
          command: "context",
          outcome: "success",
          note: `budget=${result.budgetTokens}; estimated=${result.estimatedTokens}; sources=${result.sources.length}; truncated=${result.truncated}; capsule=${commandOptions.capsule === true ? "yes" : "no"}; goal=${commandOptions.goal === undefined ? "absent" : "present"}`,
        }).catch(() => undefined);
        setExitCode(0);
      } catch (error) {
        if (
          !(error instanceof ContextServiceError) ||
          error.code !== contextServiceErrorCodes.protocolIncomplete
        ) {
          throw error;
        }

        stderr.write(
          "Context generation failed: LouisGo protocol is incomplete. Run louisgo init first.\n",
        );
        if (error.issues.length > 0) {
          stderr.write("Issues to fix:\n");
          for (const issue of error.issues) {
            stderr.write(`- ${issue.relativePath}: ${issue.message}\n`);
          }
        }
        await appendRunLogEvent({
          ...(options.cwd === undefined ? {} : { cwd: options.cwd }),
          command: "context",
          outcome: "failure",
          note: "protocol_incomplete",
        }).catch(() => undefined);
        setExitCode(1);
      }
    });
}

interface ContextCommandOptions {
  readonly budget?: number;
  readonly goal?: string;
  readonly capsule?: boolean;
}

function parseBudget(value: string): number {
  const parsed = Number.parseInt(value, 10);

  if (Number.isNaN(parsed)) {
    throw new Error(`Invalid context budget: ${value}`);
  }

  return parsed;
}
