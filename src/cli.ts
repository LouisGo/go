#!/usr/bin/env node

import { Command } from "commander";
import { realpathSync } from "node:fs";
import type { Writable } from "node:stream";
import { fileURLToPath } from "node:url";

import { registerFinishCommand } from "./commands/finish.js";
import { registerHandoffPromoteCommand } from "./commands/handoff-promote.js";
import { registerInitCommand } from "./commands/init.js";
import { registerPauseCommand } from "./commands/pause.js";
import { registerStatusCommand } from "./commands/status.js";
import { registerVerifyCommand } from "./commands/verify.js";

export interface CliOptions {
  readonly cwd?: string;
  readonly now?: () => Date;
  readonly stdout?: Writable;
  readonly stderr?: Writable;
  readonly platform?: NodeJS.Platform;
  readonly env?: NodeJS.ProcessEnv;
  readonly setExitCode?: (exitCode: number) => void;
}

export function createCli(options: CliOptions = {}): Command {
  const program = new Command();

  program
    .name("louisgo")
    .description("轻量级 AI 编程 Harness")
    .version("0.0.0")
    .showHelpAfterError();

  registerInitCommand(program, options);
  registerPauseCommand(program, options);
  registerStatusCommand(program, options);
  registerVerifyCommand(program, options);
  registerFinishCommand(program, options);
  registerHandoffPromoteCommand(program, options);

  return program;
}

export async function main(argv: string[] = process.argv): Promise<void> {
  const program = createCli();
  await program.parseAsync(argv);
}

export function isDirectRun(
  entryUrl: string = import.meta.url,
  argv: readonly string[] = process.argv,
): boolean {
  const scriptPath = argv[1];

  if (scriptPath === undefined) {
    return false;
  }

  try {
    return realpathSync(fileURLToPath(entryUrl)) === realpathSync(scriptPath);
  } catch {
    return false;
  }
}

if (isDirectRun()) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exitCode = 1;
  });
}
