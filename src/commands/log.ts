import type { Command } from "commander";
import type { Writable } from "node:stream";

import { readRunLog, type ReadRunLogOptions } from "../services/run-log-service.js";

export interface RegisterLogCommandOptions extends ReadRunLogOptions {
  readonly stdout?: Writable;
}

interface LogCommandOptions {
  readonly tail?: number;
}

export function registerLogCommand(
  program: Command,
  options: RegisterLogCommandOptions = {},
): void {
  program
    .command("log")
    .description("Print the LouisGo diagnostic log")
    .option("--tail <events>", "Only print the most recent N events", parseTail)
    .action(async (commandOptions: LogCommandOptions) => {
      const result = await readRunLog({
        ...(options.cwd === undefined ? {} : { cwd: options.cwd }),
        ...(commandOptions.tail === undefined ? {} : { tailEvents: commandOptions.tail }),
      });
      const stdout = options.stdout ?? process.stdout;

      if (result === null) {
        stdout.write(
          "There is no LouisGo diagnostic log yet. Run louisgo init to create .louisgo/RUNLOG.md.\n",
        );
        return;
      }

      stdout.write(result.content);
      if (!result.content.endsWith("\n")) {
        stdout.write("\n");
      }
    });
}

function parseTail(value: string): number {
  const parsed = Number.parseInt(value, 10);

  if (Number.isNaN(parsed) || parsed < 0) {
    throw new Error(`Invalid log event count: ${value}`);
  }

  return parsed;
}
