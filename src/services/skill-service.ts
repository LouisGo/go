import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import type { Dirent } from "node:fs";
import { basename, dirname, extname, join, relative } from "node:path";

import matter from "gray-matter";
import { z } from "zod";

import { safeWriteFile } from "../fs/safe-write.js";
import { findGitRoot } from "../fs/workspace.js";
import { isNodeError, pathExists } from "../internal/utils.js";
import { createProtocolPaths, protocolRelativePaths } from "../protocol/paths.js";
import { createCavemanSkill, createGrillSkill } from "../templates/skills.js";
import { checkProtocolStatus, type StatusServiceOptions } from "./status-service.js";

export const louisGoSkillIds = ["grill", "caveman"] as const;
export type LouisGoSkillId = (typeof louisGoSkillIds)[number];

export const localSkillManifestSchemaName = "louisgo-local-skill-index-v1" as const;

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

export interface LocalSkillIndex {
  readonly schema: typeof localSkillManifestSchemaName;
  readonly platforms: {
    readonly codex: {
      readonly status: "active";
      readonly loadMode: "lazy";
      readonly entryPoint: "AGENTS.md";
    };
    readonly claude: {
      readonly status: "reserved";
      readonly loadMode: "future";
      readonly entryPoint: "CLAUDE.md";
    };
  };
  readonly skills: readonly LocalSkillIndexEntry[];
}

export interface LocalSkillIndexEntry {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly aliases: readonly string[];
  readonly relativePath: string;
  readonly managed: boolean;
  readonly format: "markdown" | "codex-skill";
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
  readonly manifestPath: string;
}

export interface EnableSkillResult {
  readonly workspaceRoot: string;
  readonly id: LouisGoSkillId;
  readonly status: SkillEnableStatus;
  readonly filePath: string;
  readonly relativePath: string;
  readonly conflicts: readonly string[];
  readonly manifestPath: string;
}

export interface DisableSkillResult {
  readonly workspaceRoot: string;
  readonly id: LouisGoSkillId;
  readonly status: SkillDisableStatus;
  readonly filePath: string;
  readonly relativePath: string;
  readonly manifestPath: string;
}

export class SkillServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SkillServiceError";
  }
}

const managedMarkerPrefix = "<!-- louisgo-managed-skill:";
const managedMarkerSuffix = " -->";

const skillFrontMatterSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
});

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
    manifestPath: protocolRelativePaths.skillsManifest,
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
      await writeLocalSkillIndex(workspaceRoot);
      return {
        workspaceRoot,
        id: preset.id,
        status: skillEnableStatuses.unchanged,
        filePath,
        relativePath,
        conflicts: [],
        manifestPath: protocolRelativePaths.skillsManifest,
      };
    }

    return {
      workspaceRoot,
      id: preset.id,
      status: skillEnableStatuses.blocked,
      filePath,
      relativePath,
      conflicts: [relativePath],
      manifestPath: protocolRelativePaths.skillsManifest,
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
      manifestPath: protocolRelativePaths.skillsManifest,
    };
  }

  await mkdir(paths.skillsDir, { recursive: true });
  const result = await safeWriteFile(filePath, preset.createContent());
  await writeLocalSkillIndex(workspaceRoot);

  return {
    workspaceRoot,
    id: preset.id,
    status:
      result.status === "created" ? skillEnableStatuses.enabled : skillEnableStatuses.unchanged,
    filePath: result.filePath,
    relativePath,
    conflicts: [],
    manifestPath: protocolRelativePaths.skillsManifest,
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
    await writeLocalSkillIndex(workspaceRoot);
    return {
      workspaceRoot,
      id: preset.id,
      status: skillDisableStatuses.absent,
      filePath,
      relativePath,
      manifestPath: protocolRelativePaths.skillsManifest,
    };
  }

  if (!isManagedSkill(existing, preset)) {
    return {
      workspaceRoot,
      id: preset.id,
      status: skillDisableStatuses.blocked,
      filePath,
      relativePath,
      manifestPath: protocolRelativePaths.skillsManifest,
    };
  }

  await rm(filePath);
  await writeLocalSkillIndex(workspaceRoot);

  return {
    workspaceRoot,
    id: preset.id,
    status: skillDisableStatuses.disabled,
    filePath,
    relativePath,
    manifestPath: protocolRelativePaths.skillsManifest,
  };
}

export async function buildLocalSkillIndex(workspaceRoot: string): Promise<LocalSkillIndex | null> {
  const paths = createProtocolPaths(workspaceRoot);
  const entries = await readLocalSkillEntries(paths.skillsDir, workspaceRoot);

  if (entries.length === 0) {
    return null;
  }

  return {
    schema: localSkillManifestSchemaName,
    platforms: {
      codex: {
        status: "active",
        loadMode: "lazy",
        entryPoint: "AGENTS.md",
      },
      claude: {
        status: "reserved",
        loadMode: "future",
        entryPoint: "CLAUDE.md",
      },
    },
    skills: entries,
  };
}

export function renderLocalSkillIndex(index: LocalSkillIndex): string {
  const lines = [
    "# Local Skill Index",
    "",
    "## Platform Notes",
    "",
    `- Codex: ${index.platforms.codex.status} / ${index.platforms.codex.loadMode}`,
    `- Claude: ${index.platforms.claude.status} / ${index.platforms.claude.loadMode}`,
    "",
    "## Skills",
  ];

  for (const skill of index.skills) {
    lines.push(
      "",
      `- **${skill.id}** (${skill.name}) -> \`${skill.relativePath}\``,
      `  - description: ${skill.description}`,
      `  - aliases: ${skill.aliases.join(", ")}`,
      `  - mode: ${skill.managed ? "LouisGo-managed" : "project"}`,
      `  - format: ${skill.format}`,
    );
  }

  lines.push("");
  lines.push(
    "- Read only the matched skill file when the user explicitly invokes the skill by name, alias, or trigger phrase.",
  );

  return lines.join("\n");
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

async function writeLocalSkillIndex(workspaceRoot: string): Promise<void> {
  const index = await buildLocalSkillIndex(workspaceRoot);
  if (index === null) {
    await removeLocalSkillIndex(workspaceRoot);
    return;
  }

  const paths = createProtocolPaths(workspaceRoot);
  await mkdir(paths.skillsDir, { recursive: true });
  await writeFile(paths.skillsManifest, `${JSON.stringify(index, null, 2)}\n`, "utf8");
}

async function removeLocalSkillIndex(workspaceRoot: string): Promise<void> {
  const paths = createProtocolPaths(workspaceRoot);

  try {
    await rm(paths.skillsManifest);
  } catch (error) {
    if (!isNodeError(error) || error.code !== "ENOENT") {
      throw error;
    }
  }
}

async function readLocalSkillEntries(
  skillsDir: string,
  workspaceRoot: string,
): Promise<readonly LocalSkillIndexEntry[]> {
  const dirEntries = await readDirEntries(skillsDir);
  const candidates: LocalSkillCandidate[] = [];

  for (const entry of dirEntries) {
    if (entry.isDirectory()) {
      candidates.push({
        skillPath: join(skillsDir, entry.name, "SKILL.md"),
        format: "codex-skill",
      });
      continue;
    }

    if (entry.isFile() && entry.name.endsWith(".md") && entry.name !== "manifest.json") {
      candidates.push({
        skillPath: join(skillsDir, entry.name),
        format: "markdown",
      });
    }
  }

  const snapshots = await Promise.all(
    candidates.map(async ({ skillPath, format }) =>
      readLocalSkillSnapshot(skillPath, format, workspaceRoot),
    ),
  );

  const deduped = new Map<string, LocalSkillSnapshot>();

  for (const snapshot of snapshots) {
    if (snapshot === null) {
      continue;
    }

    const existing = deduped.get(snapshot.id);
    if (
      existing === undefined ||
      (existing.format === "markdown" && snapshot.format === "codex-skill") ||
      (existing.managed === false && snapshot.managed === true)
    ) {
      deduped.set(snapshot.id, snapshot);
    }
  }

  return [...deduped.values()]
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((snapshot) => ({
      id: snapshot.id,
      name: snapshot.name,
      description: snapshot.description,
      aliases: snapshot.aliases,
      relativePath: snapshot.relativePath,
      managed: snapshot.managed,
      format: snapshot.format,
    }));
}

interface LocalSkillSnapshot extends LocalSkillIndexEntry {}

interface LocalSkillCandidate {
  readonly skillPath: string;
  readonly format: LocalSkillIndexEntry["format"];
}

async function readLocalSkillSnapshot(
  skillPath: string,
  format: LocalSkillIndexEntry["format"],
  workspaceRoot: string,
): Promise<LocalSkillSnapshot | null> {
  const content = await readFileIfExists(skillPath);
  if (content === null) {
    return null;
  }

  const parsed = readSkillFrontMatter(content);
  if (parsed === null) {
    return null;
  }

  const preset = resolvePresetBySkillPath(skillPath, parsed.name);
  const id = preset?.id ?? normalizeSkillId(parsed.name, skillPath);
  const aliases = uniqueStrings([
    id,
    preset?.skillName ?? "",
    preset?.aliases ?? [],
    parsed.name,
    basename(skillPath, extname(skillPath)),
  ]);
  const managed = preset !== undefined && isManagedSkill(content, preset);

  return {
    id,
    name: parsed.name,
    description: parsed.description,
    aliases,
    relativePath: toProtocolRelativePath(workspaceRoot, skillPath),
    managed,
    format,
  };
}

function toProtocolRelativePath(workspaceRoot: string, filePath: string): string {
  return relative(workspaceRoot, filePath).replaceAll("\\", "/");
}

function resolvePresetBySkillPath(skillPath: string, name: string): SkillPreset | undefined {
  const normalized = normalizeSkillId(name, skillPath);
  const fileName = basename(skillPath);
  const parentName = basename(dirname(skillPath));

  return skillPresets.find((preset) => {
    const candidates = new Set([
      preset.id,
      preset.skillName,
      ...preset.aliases,
      preset.fileName,
      basename(preset.fileName, extname(preset.fileName)),
    ]);

    return candidates.has(normalized) || candidates.has(fileName) || candidates.has(parentName);
  });
}

function normalizeSkillId(name: string, skillPath: string): string {
  const fileName = basename(skillPath, extname(skillPath));
  return (name.trim().length > 0 ? name : fileName).trim().toLowerCase();
}

function readSkillFrontMatter(
  content: string,
): { readonly name: string; readonly description: string } | null {
  try {
    const parsed = matter(content);
    const result = skillFrontMatterSchema.safeParse(parsed.data);

    if (!result.success) {
      return null;
    }

    return {
      name: result.data.name.trim(),
      description: result.data.description.trim(),
    };
  } catch {
    return null;
  }
}

async function readDirEntries(path: string): Promise<readonly Dirent[]> {
  try {
    return await readdir(path, { withFileTypes: true });
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      return [];
    }

    throw error;
  }
}

function uniqueStrings(
  values: readonly (string | readonly string[] | undefined)[],
): readonly string[] {
  const flattened: string[] = [];
  for (const value of values) {
    if (value === undefined) {
      continue;
    }

    if (typeof value === "string") {
      if (value.trim().length > 0) {
        flattened.push(value);
      }
      continue;
    }

    flattened.push(...value);
  }

  return [...new Set(flattened.map((value) => value.trim()).filter((value) => value.length > 0))];
}
