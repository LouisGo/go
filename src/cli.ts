#!/usr/bin/env node

import { Command } from "commander";
import { pathToFileURL } from "node:url";

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

const isDirectRun =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exitCode = 1;
  });
}
