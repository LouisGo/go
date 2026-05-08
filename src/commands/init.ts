import type { Command } from "commander";
import type { Writable } from "node:stream";

import {
  initLouisGo,
  type InitServiceOptions,
  type InitServiceResult,
} from "../services/init-service.js";
import { appendRunLogEvent } from "../services/run-log-service.js";
import { setupCodex, type CodexSetupResult } from "../services/codex-service.js";
import { createOutputTheme, field, headline, statusToken, tip } from "../output/theme.js";

export interface RegisterInitCommandOptions extends InitServiceOptions {
  readonly codexHome?: string;
  readonly env?: NodeJS.ProcessEnv;
  readonly stdout?: Writable;
}

export function registerInitCommand(
  program: Command,
  options: RegisterInitCommandOptions = {},
): void {
  program
    .command("init")
    .description("🌱 Set up LouisGo memory files and Codex routing")
    .option("--no-codex", "Skip Codex integration setup")
    .action(async (commandOptions: { readonly codex?: boolean }) => {
      const result = await initLouisGo(options);
      const codex =
        commandOptions.codex === false
          ? null
          : await setupCodex({
              ...(options.cwd === undefined ? {} : { cwd: options.cwd }),
              ...(options.codexHome === undefined ? {} : { codexHome: options.codexHome }),
              ...(options.env === undefined ? {} : { env: options.env }),
            });
      writeInitResult(options.stdout ?? process.stdout, result, codex);
      await appendRunLogEvent({
        cwd: result.workspaceRoot,
        command: "init",
        outcome: "success",
        note: `files_created=${countFiles(result, "created")}; files_skipped=${countFiles(result, "skipped")}; codex=${codex === null ? "skipped" : "installed"}`,
        ...(options.now === undefined ? {} : { now: options.now }),
      }).catch(() => undefined);
    });
}

function writeInitResult(
  stdout: Writable,
  result: InitServiceResult,
  codex: CodexSetupResult | null,
): void {
  const createdCount = result.files.filter((file) => file.status === "created").length;
  const skippedCount = result.files.filter((file) => file.status === "skipped").length;
  const theme = createOutputTheme(stdout);

  stdout.write(`${headline(theme, "🌱", "LouisGo initialized", result.workspaceRoot)}\n`);
  stdout.write(`${field(theme, "Files created", statusToken(theme, String(createdCount)))}\n`);
  stdout.write(`${field(theme, "Files skipped", statusToken(theme, String(skippedCount)))}\n`);
  if (codex === null) {
    stdout.write(`${field(theme, "Codex integration", statusToken(theme, "skipped"))}\n`);
  } else {
    stdout.write(
      `${field(theme, "Codex integration", `${statusToken(theme, "completed")} (${theme.path(codex.codexHome)})`)}\n`,
    );
  }
  stdout.write(`${tip(theme, result.nextSteps.join("; "))}\n`);
}

function countFiles(result: InitServiceResult, status: "created" | "skipped"): number {
  return result.files.filter((file) => file.status === status).length;
}
