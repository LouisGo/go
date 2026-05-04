import type { Command } from "commander";
import type { Writable } from "node:stream";

import {
  initLouisGo,
  type InitServiceOptions,
  type InitServiceResult,
} from "../services/init-service.js";
import { appendRunLogEvent } from "../services/run-log-service.js";
import { setupCodex, type CodexSetupResult } from "../services/codex-service.js";

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
    .description("初始化 .louisgo 协议目录")
    .option("--no-codex", "跳过 Codex 集成安装")
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

  stdout.write(`LouisGo 初始化完成：${result.workspaceRoot}\n`);
  stdout.write(`创建文件：${createdCount}\n`);
  stdout.write(`跳过文件：${skippedCount}\n`);
  if (codex === null) {
    stdout.write("Codex 集成：已跳过\n");
  } else {
    stdout.write(`Codex 集成：完成（${codex.codexHome}）\n`);
  }
  stdout.write(`下一步：${result.nextSteps.join("；")}\n`);
}

function countFiles(result: InitServiceResult, status: "created" | "skipped"): number {
  return result.files.filter((file) => file.status === status).length;
}
