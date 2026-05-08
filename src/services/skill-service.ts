import { mkdir, readdir, readFile, rm } from "node:fs/promises";
import { join } from "node:path";

import { safeWriteFile } from "../fs/safe-write.js";
import { findGitRoot } from "../fs/workspace.js";
import { isNodeError, pathExists } from "../internal/utils.js";
import { createProtocolPaths, protocolRelativePaths } from "../protocol/paths.js";
import { createCavemanSkill, createGrillSkill } from "../templates/skills.js";
import { checkProtocolStatus, type StatusServiceOptions } from "./status-service.js";

export const louisGoSkillIds = ["grill", "caveman"] as const;
export type LouisGoSkillId = (typeof louisGoSkillIds)[number];

export const skillEnableStatuses = {
  enabled: "enabled",
  unchanged: "unchanged",
  blocked: "blocked",
} as const;

export type SkillEnableStatus = (typeof skillEnableStatuses)[keyof typeof skillEnableStatuses];

export const skillDisableStatuses = {
  disabled: "disabled",
  absent: "absent",
  blocked: "blocked",
} as const;

export type SkillDisableStatus = (typeof skillDisableStatuses)[keyof typeof skillDisableStatuses];

export interface SkillPreset {
  readonly id: LouisGoSkillId;
  readonly skillName: string;
  readonly fileName: string;
  readonly aliases: readonly string[];
  readonly description: string;
  readonly createContent: () => string;
}

export interface SkillStatus {
  readonly id: LouisGoSkillId;
  readonly skillName: string;
  readonly description: string;
  readonly enabled: boolean;
  readonly filePath: string;
  readonly relativePath: string;
  readonly conflicts: readonly string[];
}

export interface ListSkillsResult {
  readonly workspaceRoot: string;
  readonly skills: readonly SkillStatus[];
}

export interface EnableSkillResult {
  readonly workspaceRoot: string;
  readonly id: LouisGoSkillId;
  readonly status: SkillEnableStatus;
  readonly filePath: string;
  readonly relativePath: string;
  readonly conflicts: readonly string[];
}

export interface DisableSkillResult {
  readonly workspaceRoot: string;
  readonly id: LouisGoSkillId;
  readonly status: SkillDisableStatus;
  readonly filePath: string;
  readonly relativePath: string;
}

export class SkillServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SkillServiceError";
  }
}

const managedMarkerPrefix = "<!-- louisgo-managed-skill:";
const managedMarkerSuffix = " -->";

const skillPresets: readonly SkillPreset[] = [
  {
    id: "grill",
    skillName: "grill-me",
    fileName: "grill.md",
    aliases: ["grill", "grill-me"],
    description:
      "Pressure-test a plan branch by branch until the tradeoffs are jointly understood.",
    createContent: () => withManagedMarker("grill", createGrillSkill()),
  },
  {
    id: "caveman",
    skillName: "caveman",
    fileName: "caveman.md",
    aliases: ["caveman", "cavemen"],
    description: "Use ultra-compressed communication while preserving technical accuracy.",
    createContent: () => withManagedMarker("caveman", createCavemanSkill()),
  },
];

export async function listSkills(options: StatusServiceOptions = {}): Promise<ListSkillsResult> {
  const workspaceRoot = await ensureProtocol(options);
  const skills = await Promise.all(
    skillPresets.map((preset) => readSkillStatus(workspaceRoot, preset)),
  );

  return {
    workspaceRoot,
    skills,
  };
}

export async function enableSkill(
  id: string,
  options: StatusServiceOptions = {},
): Promise<EnableSkillResult> {
  const preset = resolvePreset(id);
  const workspaceRoot = await ensureProtocol(options);
  const paths = createProtocolPaths(workspaceRoot);
  const filePath = join(paths.skillsDir, preset.fileName);
  const relativePath = skillRelativePath(preset);
  const existing = await readFileIfExists(filePath);

  if (existing !== null) {
    if (isManagedSkill(existing, preset)) {
      return {
        workspaceRoot,
        id: preset.id,
        status: skillEnableStatuses.unchanged,
        filePath,
        relativePath,
        conflicts: [],
      };
    }

    return {
      workspaceRoot,
      id: preset.id,
      status: skillEnableStatuses.blocked,
      filePath,
      relativePath,
      conflicts: [relativePath],
    };
  }

  const conflicts = await findSkillConflicts(workspaceRoot, preset);
  if (conflicts.length > 0) {
    return {
      workspaceRoot,
      id: preset.id,
      status: skillEnableStatuses.blocked,
      filePath,
      relativePath,
      conflicts,
    };
  }

  await mkdir(paths.skillsDir, { recursive: true });
  const result = await safeWriteFile(filePath, preset.createContent());

  return {
    workspaceRoot,
    id: preset.id,
    status:
      result.status === "created" ? skillEnableStatuses.enabled : skillEnableStatuses.unchanged,
    filePath: result.filePath,
    relativePath,
    conflicts: [],
  };
}

export async function disableSkill(
  id: string,
  options: StatusServiceOptions = {},
): Promise<DisableSkillResult> {
  const preset = resolvePreset(id);
  const workspaceRoot = await ensureProtocol(options);
  const paths = createProtocolPaths(workspaceRoot);
  const filePath = join(paths.skillsDir, preset.fileName);
  const relativePath = skillRelativePath(preset);
  const existing = await readFileIfExists(filePath);

  if (existing === null) {
    return {
      workspaceRoot,
      id: preset.id,
      status: skillDisableStatuses.absent,
      filePath,
      relativePath,
    };
  }

  if (!isManagedSkill(existing, preset)) {
    return {
      workspaceRoot,
      id: preset.id,
      status: skillDisableStatuses.blocked,
      filePath,
      relativePath,
    };
  }

  await rm(filePath);

  return {
    workspaceRoot,
    id: preset.id,
    status: skillDisableStatuses.disabled,
    filePath,
    relativePath,
  };
}

function resolvePreset(id: string): SkillPreset {
  const normalized = id.trim().toLowerCase();
  const preset = skillPresets.find(
    (candidate) => candidate.id === normalized || candidate.aliases.includes(normalized),
  );

  if (preset === undefined) {
    throw new SkillServiceError(
      `Unknown LouisGo skill: ${id}. Available presets: ${skillPresets.map((item) => item.id).join(", ")}`,
    );
  }

  return preset;
}

async function ensureProtocol(options: StatusServiceOptions): Promise<string> {
  const status = await checkProtocolStatus({
    ...(options.cwd === undefined ? {} : { cwd: options.cwd }),
  });

  if (!status.complete) {
    throw new SkillServiceError("LouisGo protocol is incomplete. Run louisgo init first.");
  }

  return status.workspaceRoot;
}

async function readSkillStatus(workspaceRoot: string, preset: SkillPreset): Promise<SkillStatus> {
  const paths = createProtocolPaths(workspaceRoot);
  const filePath = join(paths.skillsDir, preset.fileName);
  const enabled = await pathExists(filePath);
  const conflicts = enabled ? [] : await findSkillConflicts(workspaceRoot, preset);

  return {
    id: preset.id,
    skillName: preset.skillName,
    description: preset.description,
    enabled,
    filePath,
    relativePath: skillRelativePath(preset),
    conflicts,
  };
}

async function findSkillConflicts(
  workspaceRoot: string,
  preset: SkillPreset,
): Promise<readonly string[]> {
  const candidates = [
    ...(await findLouisGoSkillConflicts(workspaceRoot, preset)),
    ...(await findCodexSkillConflicts(workspaceRoot, preset)),
  ];

  return [...new Set(candidates)].sort();
}

async function findLouisGoSkillConflicts(
  workspaceRoot: string,
  preset: SkillPreset,
): Promise<readonly string[]> {
  const paths = createProtocolPaths(workspaceRoot);
  const conflicts: string[] = [];

  for (const alias of preset.aliases) {
    const fileName = `${alias}.md`;
    const filePath = join(paths.skillsDir, fileName);
    if (fileName !== preset.fileName && (await pathExists(filePath))) {
      conflicts.push(`${protocolRelativePaths.skillsDir}/${fileName}`);
    }
  }

  return conflicts;
}

async function findCodexSkillConflicts(
  workspaceRoot: string,
  preset: SkillPreset,
): Promise<readonly string[]> {
  const codexSkillsDir = join(workspaceRoot, ".codex", "skills");

  if (!(await pathExists(codexSkillsDir))) {
    return [];
  }

  const entries = await readdir(codexSkillsDir, { withFileTypes: true });
  const conflicts: string[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const skillPath = join(codexSkillsDir, entry.name, "SKILL.md");
    if (!(await pathExists(skillPath))) {
      continue;
    }

    const content = await readFile(skillPath, "utf8");
    const skillName = readSkillName(content);
    if (
      preset.aliases.includes(entry.name) ||
      (skillName !== null && preset.aliases.includes(skillName))
    ) {
      conflicts.push(`.codex/skills/${entry.name}/SKILL.md`);
    }
  }

  return conflicts;
}

function readSkillName(content: string): string | null {
  const match = content.match(/^name:\s*["']?([^"'\n]+)["']?\s*$/m);
  return match?.[1]?.trim().toLowerCase() ?? null;
}

async function readFileIfExists(filePath: string): Promise<string | null> {
  try {
    return await readFile(filePath, "utf8");
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      return null;
    }

    throw error;
  }
}

function withManagedMarker(id: LouisGoSkillId, content: string): string {
  return `${content.trimEnd()}\n\n${managedMarkerPrefix}${id}${managedMarkerSuffix}\n`;
}

function isManagedSkill(content: string, preset: SkillPreset): boolean {
  return content.includes(`${managedMarkerPrefix}${preset.id}${managedMarkerSuffix}`);
}

function skillRelativePath(preset: SkillPreset): string {
  return `${protocolRelativePaths.skillsDir}/${preset.fileName}`;
}
