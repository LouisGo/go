import type { Command } from "commander";
import type { Writable } from "node:stream";

import {
  disableSkill,
  enableSkill,
  listSkills,
  SkillServiceError,
  skillDisableStatuses,
  skillEnableStatuses,
  type DisableSkillResult,
  type EnableSkillResult,
  type ListSkillsResult,
} from "../services/skill-service.js";
import { appendRunLogEvent } from "../services/run-log-service.js";

export interface RegisterSkillCommandOptions {
  readonly cwd?: string;
  readonly stdout?: Writable;
  readonly stderr?: Writable;
  readonly setExitCode?: (exitCode: number) => void;
}

export function registerSkillCommand(
  program: Command,
  options: RegisterSkillCommandOptions = {},
): void {
  const skill = program.command("skill").description("按需管理 LouisGo 预设 skill");

  skill
    .command("list")
    .description("列出可用 LouisGo 预设 skill 及冲突状态")
    .action(async () => {
      await runSkillAction(options, "skill list", async () => {
        const result = await listSkills({
          ...(options.cwd === undefined ? {} : { cwd: options.cwd }),
        });
        writeListResult(options.stdout ?? process.stdout, result);
      });
    });

  skill
    .command("enable")
    .argument("<name>", "预设 skill 名称：grill 或 caveman")
    .description("启用一个 LouisGo 预设 skill")
    .action(async (name: string) => {
      await runSkillAction(options, `skill enable ${name}`, async () => {
        const result = await enableSkill(name, {
          ...(options.cwd === undefined ? {} : { cwd: options.cwd }),
        });
        writeEnableResult(options.stdout ?? process.stdout, result);
      });
    });

  skill
    .command("disable")
    .argument("<name>", "预设 skill 名称：grill 或 caveman")
    .description("停用一个 LouisGo 管理的预设 skill")
    .action(async (name: string) => {
      await runSkillAction(options, `skill disable ${name}`, async () => {
        const result = await disableSkill(name, {
          ...(options.cwd === undefined ? {} : { cwd: options.cwd }),
        });
        writeDisableResult(options.stdout ?? process.stdout, result);
      });
    });
}

async function runSkillAction(
  options: RegisterSkillCommandOptions,
  command: string,
  action: () => Promise<void>,
): Promise<void> {
  const stderr = options.stderr ?? process.stderr;
  const setExitCode =
    options.setExitCode ??
    ((exitCode: number) => {
      process.exitCode = exitCode;
    });

  try {
    await action();
    await appendRunLogEvent({
      ...(options.cwd === undefined ? {} : { cwd: options.cwd }),
      command,
      outcome: "success",
    }).catch(() => undefined);
    setExitCode(0);
  } catch (error) {
    if (!(error instanceof SkillServiceError)) {
      throw error;
    }

    stderr.write(`${error.message}\n`);
    await appendRunLogEvent({
      ...(options.cwd === undefined ? {} : { cwd: options.cwd }),
      command,
      outcome: "failure",
      note: error.message,
    }).catch(() => undefined);
    setExitCode(1);
  }
}

function writeListResult(stdout: Writable, result: ListSkillsResult): void {
  stdout.write(`LouisGo 预设 skills：${result.workspaceRoot}\n`);

  for (const skill of result.skills) {
    const state = skill.enabled ? "enabled" : skill.conflicts.length > 0 ? "blocked" : "available";
    stdout.write(`- ${skill.id} [${state}] ${skill.description}\n`);
    if (skill.enabled) {
      stdout.write(`  path: ${skill.relativePath}\n`);
    }
    if (skill.conflicts.length > 0) {
      stdout.write(`  conflicts: ${skill.conflicts.join(", ")}\n`);
    }
  }
}

function writeEnableResult(stdout: Writable, result: EnableSkillResult): void {
  if (result.status === skillEnableStatuses.enabled) {
    stdout.write(`LouisGo skill 已启用：${result.id} -> ${result.relativePath}\n`);
    return;
  }

  if (result.status === skillEnableStatuses.unchanged) {
    stdout.write(`LouisGo skill 已存在：${result.id} -> ${result.relativePath}\n`);
    return;
  }

  stdout.write(`LouisGo skill 未启用：${result.id}\n`);
  stdout.write(`发现同名 skill：${result.conflicts.join(", ")}\n`);
  stdout.write("请先处理项目内同名 skill，LouisGo 不会自动覆盖。\n");
}

function writeDisableResult(stdout: Writable, result: DisableSkillResult): void {
  if (result.status === skillDisableStatuses.disabled) {
    stdout.write(`LouisGo skill 已停用：${result.id} -> ${result.relativePath}\n`);
    return;
  }

  if (result.status === skillDisableStatuses.absent) {
    stdout.write(`LouisGo skill 未启用：${result.id}\n`);
    return;
  }

  stdout.write(`LouisGo skill 未停用：${result.id}\n`);
  stdout.write(`${result.relativePath} 不是 LouisGo 管理的预设文件，请手动处理。\n`);
}
