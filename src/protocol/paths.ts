import { join, posix, resolve } from "node:path";

export const louisgoDirectoryName = ".louisgo";

export const verificationIgnoredRelativePaths = [
  ".louisgo/test-results.json",
  ".louisgo/CONFIRM_REQ.md",
] as const;

export const protocolFileNames = {
  mission: "MISSION.md",
  confirmReq: "CONFIRM_REQ.md",
  capabilities: "CAPABILITIES.md",
  context: "CONTEXT.md",
  testResults: "test-results.json",
  gitignore: ".gitignore",
} as const;

export const protocolDirectoryNames = {
  adr: "ADR",
  adrDraft: "draft",
  scripts: "scripts",
  skills: "skills",
} as const;

export const protocolSkillFileNames = {
  manifest: "manifest.json",
} as const;

export const protocolScriptNames = {
  verifySh: "verify.sh",
  verifyPs1: "verify.ps1",
} as const;

export const protocolRelativePaths = {
  louisgoDir: louisgoDirectoryName,
  mission: protocolRelativePath(protocolFileNames.mission),
  confirmReq: protocolRelativePath(protocolFileNames.confirmReq),
  capabilities: protocolRelativePath(protocolFileNames.capabilities),
  context: protocolRelativePath(protocolFileNames.context),
  testResults: protocolRelativePath(protocolFileNames.testResults),
  gitignore: protocolRelativePath(protocolFileNames.gitignore),
  adrDir: protocolRelativePath(protocolDirectoryNames.adr),
  adrDraftDir: protocolRelativePath(protocolDirectoryNames.adr, protocolDirectoryNames.adrDraft),
  scriptsDir: protocolRelativePath(protocolDirectoryNames.scripts),
  skillsDir: protocolRelativePath(protocolDirectoryNames.skills),
  skillsManifest: protocolRelativePath(
    protocolDirectoryNames.skills,
    protocolSkillFileNames.manifest,
  ),
  verifySh: protocolRelativePath(protocolDirectoryNames.scripts, protocolScriptNames.verifySh),
  verifyPs1: protocolRelativePath(protocolDirectoryNames.scripts, protocolScriptNames.verifyPs1),
} as const;

export interface ProtocolPaths {
  readonly workspaceRoot: string;
  readonly louisgoDir: string;
  readonly mission: string;
  readonly confirmReq: string;
  readonly capabilities: string;
  readonly context: string;
  readonly testResults: string;
  readonly gitignore: string;
  readonly adrDir: string;
  readonly adrDraftDir: string;
  readonly scriptsDir: string;
  readonly skillsDir: string;
  readonly skillsManifest: string;
  readonly verifySh: string;
  readonly verifyPs1: string;
}

export function createProtocolPaths(workspaceRoot: string): ProtocolPaths {
  const root = resolve(workspaceRoot);

  return {
    workspaceRoot: root,
    louisgoDir: absoluteProtocolPath(root),
    mission: absoluteProtocolPath(root, protocolFileNames.mission),
    confirmReq: absoluteProtocolPath(root, protocolFileNames.confirmReq),
    capabilities: absoluteProtocolPath(root, protocolFileNames.capabilities),
    context: absoluteProtocolPath(root, protocolFileNames.context),
    testResults: absoluteProtocolPath(root, protocolFileNames.testResults),
    gitignore: absoluteProtocolPath(root, protocolFileNames.gitignore),
    adrDir: absoluteProtocolPath(root, protocolDirectoryNames.adr),
    adrDraftDir: absoluteProtocolPath(
      root,
      protocolDirectoryNames.adr,
      protocolDirectoryNames.adrDraft,
    ),
    scriptsDir: absoluteProtocolPath(root, protocolDirectoryNames.scripts),
    skillsDir: absoluteProtocolPath(root, protocolDirectoryNames.skills),
    skillsManifest: absoluteProtocolPath(
      root,
      protocolDirectoryNames.skills,
      protocolSkillFileNames.manifest,
    ),
    verifySh: absoluteProtocolPath(
      root,
      protocolDirectoryNames.scripts,
      protocolScriptNames.verifySh,
    ),
    verifyPs1: absoluteProtocolPath(
      root,
      protocolDirectoryNames.scripts,
      protocolScriptNames.verifyPs1,
    ),
  };
}

function protocolRelativePath(...parts: string[]): string {
  return posix.join(louisgoDirectoryName, ...parts);
}

function absoluteProtocolPath(workspaceRoot: string, ...parts: string[]): string {
  return join(workspaceRoot, louisgoDirectoryName, ...parts);
}
