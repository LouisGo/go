import { select } from "@inquirer/prompts";
import type { Command } from "commander";
import { Writable, type Readable } from "node:stream";

import {
  clearLouisGo,
  type ClearLouisGoOptions,
  type ClearLouisGoResult,
} from "../services/clear-service.js";

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
    .description("Remove LouisGo protocol files and local caches from the current project")
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
        stdout.write("Canceled. No files were deleted.\n");
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
  stdout.write(
    "Dangerous operation: this will remove LouisGo data from the current Git project.\n",
  );
  stdout.write(
    "- Deletes .louisgo/, including project memory, handoffs, verification results, diagnostics, stats, and local caches.\n",
  );
  stdout.write("- Removes the LouisGo-managed Codex block from project agent instruction files.\n");
  stdout.write("- Does not delete product source code, global Codex config, or global skills.\n");
}

function writeClearResult(stdout: Writable, result: ClearLouisGoResult): void {
  stdout.write(
    result.dryRun
      ? `Cleanup preview: ${result.workspaceRoot}\n`
      : `LouisGo project data removed: ${result.workspaceRoot}\n`,
  );

  for (const target of result.targets) {
    stdout.write(`- ${target.status} ${target.relativePath}: ${target.description}\n`);
  }

  if (result.dryRun) {
    stdout.write("No deletion was performed.\n");
  }
}

async function askClearConfirmation(stdin: Readable, stdout: Writable): Promise<boolean> {
  const answer = await select(
    {
      message: "Select cleanup action",
      choices: [
        {
          name: "Cancel and keep all files",
          value: "cancel",
        },
        {
          name: "I understand the risk. Remove LouisGo project data.",
          value: "clear",
          description: "Deletes .louisgo/ and removes the LouisGo block from project agent files",
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

class PromptOutput extends Writable {
  readonly columns: number;
  readonly rows: number;
  readonly isTTY: boolean;

  constructor(private readonly target: Writable) {
    super();
    const output = target as Writable & {
      readonly columns?: number;
      readonly rows?: number;
      readonly isTTY?: boolean;
    };
    this.columns = output.columns ?? 80;
    this.rows = output.rows ?? 24;
    this.isTTY = output.isTTY ?? true;
  }

  override _write(
    chunk: string | Buffer,
    encoding: BufferEncoding,
    callback: (error?: Error | null) => void,
  ): void {
    this.target.write(chunk, encoding, callback);
  }
}

function createPromptOutput(stdout: Writable): Writable {
  return new PromptOutput(stdout);
}
