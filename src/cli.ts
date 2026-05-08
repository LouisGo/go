#!/usr/bin/env node

import { Command } from "commander";
import { realpathSync } from "node:fs";
import type { Readable, Writable } from "node:stream";
import { fileURLToPath } from "node:url";

import { registerClearCommand } from "./commands/clear.js";
import { registerCodexCommand } from "./commands/codex.js";
import { registerConfirmCommand } from "./commands/confirm.js";
import { registerContextCommand } from "./commands/context.js";
import { registerFinishCommand } from "./commands/finish.js";
import { registerHandoffPromoteCommand } from "./commands/handoff-promote.js";
import { registerInitCommand } from "./commands/init.js";
import { registerLogCommand } from "./commands/log.js";
import { registerPauseCommand } from "./commands/pause.js";
import { registerSkillCommand } from "./commands/skill.js";
import { registerStatusCommand } from "./commands/status.js";
import { registerStatsCommand } from "./commands/stats.js";
import { registerVerifyCommand } from "./commands/verify.js";
import { readPackageVersion } from "./package-info.js";

export interface CliOptions {
  readonly cwd?: string;
  readonly codexHome?: string;
  readonly now?: () => Date;
  readonly stdin?: Readable;
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
    .version(readPackageVersion())
    .showHelpAfterError();

  registerInitCommand(program, options);
  registerPauseCommand(program, options);
  registerStatusCommand(program, options);
  registerStatsCommand(program, options);
  registerConfirmCommand(program, options);
  registerContextCommand(program, options);
  registerVerifyCommand(program, options);
  registerFinishCommand(program, options);
  registerHandoffPromoteCommand(program, options);
  registerCodexCommand(program, options);
  registerSkillCommand(program, options);
  registerLogCommand(program, options);
  registerClearCommand(program, options);

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
