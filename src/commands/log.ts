import type { Command } from "commander";
import type { Writable } from "node:stream";

import { readRunLog, type ReadRunLogOptions } from "../services/run-log-service.js";

export interface RegisterLogCommandOptions extends ReadRunLogOptions {
  readonly stdout?: Writable;
}

interface LogCommandOptions {
  readonly tail?: number;
}

export function registerLogCommand(
  program: Command,
  options: RegisterLogCommandOptions = {},
): void {
  program
    .command("log")
    .description("输出 LouisGo 诊断日志")
    .option("--tail <events>", "只输出最近 N 条事件", parseTail)
    .action(async (commandOptions: LogCommandOptions) => {
      const result = await readRunLog({
        ...(options.cwd === undefined ? {} : { cwd: options.cwd }),
        ...(commandOptions.tail === undefined ? {} : { tailEvents: commandOptions.tail }),
      });
      const stdout = options.stdout ?? process.stdout;

      if (result === null) {
        stdout.write(
          "当前没有 LouisGo 诊断日志。运行 louisgo init 或任一 LouisGo 命令后会生成 .louisgo/RUNLOG.md。\n",
        );
        return;
      }

      stdout.write(result.content);
      if (!result.content.endsWith("\n")) {
        stdout.write("\n");
      }
    });
}

function parseTail(value: string): number {
  const parsed = Number.parseInt(value, 10);

  if (Number.isNaN(parsed) || parsed < 0) {
    throw new Error(`无效日志条数：${value}`);
  }

  return parsed;
}
