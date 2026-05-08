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
  const skill = program.command("skill").description("Manage optional LouisGo preset skills");

  skill
    .command("list")
    .description("List available LouisGo preset skills and conflict status")
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
    .argument("<name>", "Preset skill name: grill or caveman")
    .description("Enable a LouisGo preset skill")
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
    .argument("<name>", "Preset skill name: grill or caveman")
    .description("Disable a LouisGo-managed preset skill")
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
  stdout.write(`LouisGo preset skills: ${result.workspaceRoot}\n`);

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
    stdout.write(`LouisGo skill enabled: ${result.id} -> ${result.relativePath}\n`);
    return;
  }

  if (result.status === skillEnableStatuses.unchanged) {
    stdout.write(`LouisGo skill already exists: ${result.id} -> ${result.relativePath}\n`);
    return;
  }

  stdout.write(`LouisGo skill was not enabled: ${result.id}\n`);
  stdout.write(`Same-name skill found: ${result.conflicts.join(", ")}\n`);
  stdout.write("Resolve the project skill conflict first. LouisGo will not overwrite it.\n");
}

function writeDisableResult(stdout: Writable, result: DisableSkillResult): void {
  if (result.status === skillDisableStatuses.disabled) {
    stdout.write(`LouisGo skill disabled: ${result.id} -> ${result.relativePath}\n`);
    return;
  }

  if (result.status === skillDisableStatuses.absent) {
    stdout.write(`LouisGo skill is not enabled: ${result.id}\n`);
    return;
  }

  stdout.write(`LouisGo skill was not disabled: ${result.id}\n`);
  stdout.write(
    `${result.relativePath} is not a LouisGo-managed preset file. Handle it manually.\n`,
  );
}
