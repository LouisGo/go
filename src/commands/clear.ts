import { select } from "@inquirer/prompts";
import type { Command } from "commander";
import type { Writable, Readable } from "node:stream";

import {
  clearLouisGo,
  type ClearLouisGoOptions,
  type ClearLouisGoResult,
} from "../services/clear-service.js";
import { createOutputTheme, headline, statusIcon, statusToken, tip } from "../output/theme.js";
import { createPromptOutput } from "../output/prompt.js";

export interface RegisterClearCommandOptions extends ClearLouisGoOptions {
  readonly stdin?: Readable;
  readonly stdout?: Writable;
  readonly setExitCode?: (exitCode: number) => void;
}

interface ClearCommandOptions {
  readonly dryRun?: boolean;
}

export function registerClearCommand(
  program: Command,
  options: RegisterClearCommandOptions = {},
): void {
  program
    .command("clear")
    .description("🧹 Remove LouisGo files from this project, with confirmation")
    .option("--dry-run", "Preview cleanup targets without deleting anything")
    .action(async (commandOptions: ClearCommandOptions) => {
      const stdout = options.stdout ?? process.stdout;
      const setExitCode =
        options.setExitCode ??
        ((exitCode: number) => {
          process.exitCode = exitCode;
        });
      writeRiskWarning(stdout);

      if (commandOptions.dryRun === true) {
        const result = await clearLouisGo({
          ...(options.cwd === undefined ? {} : { cwd: options.cwd }),
          dryRun: true,
        });
        writeClearResult(stdout, result);
        setExitCode(0);
        return;
      }

      const preview = await clearLouisGo({
        ...(options.cwd === undefined ? {} : { cwd: options.cwd }),
        dryRun: true,
      });
      writeClearResult(stdout, preview);
      const confirmed = await askClearConfirmation(options.stdin ?? process.stdin, stdout);

      if (!confirmed) {
        const theme = createOutputTheme(stdout);
        stdout.write(`${headline(theme, "↩️", "Canceled")}\n`);
        stdout.write(`${tip(theme, "No files were deleted.")}\n`);
        setExitCode(1);
        return;
      }

      const result = await clearLouisGo({
        ...(options.cwd === undefined ? {} : { cwd: options.cwd }),
      });
      writeClearResult(stdout, result);
      setExitCode(0);
    });
}

function writeRiskWarning(stdout: Writable): void {
  const theme = createOutputTheme(stdout);

  stdout.write(`${headline(theme, "⚠️", "Dangerous operation")}\n`);
  stdout.write(
    `  ${theme.warning("Deletes")} ${theme.path(".louisgo/")} including the project anchor and legacy protocol files. Private task state under the user store is not removed.\n`,
  );
  stdout.write(
    `  ${theme.warning("Removes")} the LouisGo-managed Codex block from project agent instruction files.\n`,
  );
  stdout.write(
    `  ${theme.success("Keeps")} product source code, global Codex config, and global skills untouched.\n`,
  );
}

function writeClearResult(stdout: Writable, result: ClearLouisGoResult): void {
  const theme = createOutputTheme(stdout);
  stdout.write(
    result.dryRun
      ? `${headline(theme, "🧭", "Cleanup preview", result.workspaceRoot)}\n`
      : `${headline(theme, "🧹", "LouisGo project data removed", result.workspaceRoot)}\n`,
  );

  for (const target of result.targets) {
    stdout.write(
      `  ${statusIcon(target.status)} ${statusToken(theme, target.status)} ${theme.path(target.relativePath)}: ${target.description}\n`,
    );
  }

  if (result.dryRun) {
    stdout.write(`${tip(theme, "Preview only. No files were deleted.")}\n`);
  }
}

async function askClearConfirmation(stdin: Readable, stdout: Writable): Promise<boolean> {
  const answer = await select(
    {
      message: "🧹 Choose cleanup action",
      choices: [
        {
          name: "Keep everything",
          value: "cancel",
          description: "Exit now and leave every LouisGo file exactly where it is",
        },
        {
          name: "Clear this project's LouisGo data",
          value: "clear",
          description: "Deletes .louisgo/ and removes only the LouisGo-managed agent block",
        },
      ],
      default: "cancel",
      loop: false,
    },
    {
      input: stdin,
      output: createPromptOutput(stdout),
      clearPromptOnDone: false,
    },
  );

  return answer === "clear";
}
