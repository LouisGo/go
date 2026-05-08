import type { Command } from "commander";
import type { Writable } from "node:stream";

import {
  setupCodex,
  type CodexSetupOptions,
  type CodexSetupResult,
} from "../services/codex-service.js";
import { appendRunLogEvent } from "../services/run-log-service.js";
import {
  createOutputTheme,
  field,
  headline,
  statusIcon,
  statusToken,
  tip,
} from "../output/theme.js";

export interface RegisterCodexCommandOptions extends CodexSetupOptions {
  readonly stdout?: Writable;
}

export function registerCodexCommand(
  program: Command,
  options: RegisterCodexCommandOptions = {},
): void {
  const codex = program
    .command("codex")
    .description("🧭 Install the LouisGo Codex workflow integration");

  codex
    .command("setup")
    .description("Install LouisGo Codex directives such as $start")
    .action(async () => {
      const result = await setupCodex(options);
      writeCodexSetupResult(options.stdout ?? process.stdout, result);
      await appendRunLogEvent({
        cwd: result.workspaceRoot,
        command: "codex setup",
        outcome: "success",
        note: `files=${result.files.length}; codex_home=${result.codexHome}`,
      }).catch(() => undefined);
    });
}

function writeCodexSetupResult(stdout: Writable, result: CodexSetupResult): void {
  const theme = createOutputTheme(stdout);
  stdout.write(
    `${headline(theme, "🧭", "LouisGo Codex integration completed", result.workspaceRoot)}\n`,
  );
  stdout.write(`${field(theme, "Codex home", theme.path(result.codexHome))}\n`);
  stdout.write(`${theme.bold("Written files")}\n`);

  for (const file of result.files) {
    stdout.write(
      `  ${statusIcon(file.status)} ${statusToken(theme, file.status)} ${theme.path(file.filePath)}\n`,
    );
  }

  stdout.write(`${tip(theme, result.nextSteps.join("; "))}\n`);
}
