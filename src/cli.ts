#!/usr/bin/env node

import { Command } from "commander";
import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";

export function createCli(): Command {
  const program = new Command();

  program
    .name("louisgo")
    .description("轻量级 AI 编程 Harness")
    .version("0.0.0")
    .showHelpAfterError();

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
