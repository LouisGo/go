import type { Command } from "commander";
import type { Writable } from "node:stream";

import {
  initLouisGo,
  type InitServiceOptions,
  type InitServiceResult,
} from "../services/init-service.js";

export interface RegisterInitCommandOptions extends InitServiceOptions {
  readonly stdout?: Writable;
}

export function registerInitCommand(
  program: Command,
  options: RegisterInitCommandOptions = {},
): void {
  program
    .command("init")
    .description("初始化 .louisgo 协议目录")
    .action(async () => {
      const result = await initLouisGo(options);
      writeInitResult(options.stdout ?? process.stdout, result);
    });
}

function writeInitResult(stdout: Writable, result: InitServiceResult): void {
  const createdCount = result.files.filter((file) => file.status === "created").length;
  const skippedCount = result.files.filter((file) => file.status === "skipped").length;

  stdout.write(`LouisGo 初始化完成：${result.workspaceRoot}\n`);
  stdout.write(`创建文件：${createdCount}\n`);
  stdout.write(`跳过文件：${skippedCount}\n`);
  stdout.write(`下一步：${result.nextSteps.join("；")}\n`);
}
