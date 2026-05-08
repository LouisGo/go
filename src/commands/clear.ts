import type { Command } from "commander";
import { createInterface } from "node:readline/promises";
import type { Readable, Writable } from "node:stream";

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
    .description("清空当前项目的 LouisGo 协议文件和本地缓存")
    .option("--dry-run", "只预览会清理的目标，不实际删除")
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
        stdout.write("已取消，未删除任何文件。\n");
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
  stdout.write("危险操作：即将清理当前 Git 项目的 LouisGo 数据。\n");
  stdout.write("- 会删除 .louisgo/，包括项目记忆、交接、验证结果、诊断日志、stats 和本地缓存。\n");
  stdout.write("- 会移除 AGENTS.md 中 LouisGo 管理的 Codex 指令块。\n");
  stdout.write("- 不会删除业务源码，也不会清理全局 Codex 配置或全局 skills。\n");
}

function writeClearResult(stdout: Writable, result: ClearLouisGoResult): void {
  stdout.write(
    result.dryRun
      ? `清理预览：${result.workspaceRoot}\n`
      : `LouisGo 项目数据已清理：${result.workspaceRoot}\n`,
  );

  for (const target of result.targets) {
    stdout.write(`- ${target.status} ${target.relativePath}：${target.description}\n`);
  }

  if (result.dryRun) {
    stdout.write("未执行删除。\n");
  }
}

async function askClearConfirmation(stdin: Readable, stdout: Writable): Promise<boolean> {
  stdout.write("\n请选择：\n");
  stdout.write("- A. 取消，不删除任何文件\n");
  stdout.write("- B. 我理解风险，清理当前项目 LouisGo 数据\n");

  const readline = createInterface({ input: stdin, output: stdout });

  try {
    const answer = await readline.question("请输入 A/B：");
    return answer.trim().toUpperCase() === "B";
  } finally {
    readline.close();
  }
}
