import { join, posix, resolve } from "node:path";

export const louisgoDirectoryName = ".louisgo";

export const protocolFileNames = {
  mission: "MISSION.md",
  roadmap: "ROADMAP.md",
  handoff: "HANDOFF.md",
  handoffDraft: "HANDOFF_DRAFT.md",
  quickSave: "QUICK_SAVE.md",
  blocker: "BLOCKER.md",
  confirmReq: "CONFIRM_REQ.md",
  capabilities: "CAPABILITIES.md",
  testResults: "test-results.json",
} as const;

export const protocolDirectoryNames = {
  adr: "ADR",
  adrDraft: "draft",
  scripts: "scripts",
} as const;

export const protocolScriptNames = {
  verifySh: "verify.sh",
  verifyPs1: "verify.ps1",
} as const;

export const protocolRelativePaths = {
  louisgoDir: louisgoDirectoryName,
  mission: protocolRelativePath(protocolFileNames.mission),
  roadmap: protocolRelativePath(protocolFileNames.roadmap),
  handoff: protocolRelativePath(protocolFileNames.handoff),
  handoffDraft: protocolRelativePath(protocolFileNames.handoffDraft),
  quickSave: protocolRelativePath(protocolFileNames.quickSave),
  blocker: protocolRelativePath(protocolFileNames.blocker),
  confirmReq: protocolRelativePath(protocolFileNames.confirmReq),
  capabilities: protocolRelativePath(protocolFileNames.capabilities),
  testResults: protocolRelativePath(protocolFileNames.testResults),
  adrDir: protocolRelativePath(protocolDirectoryNames.adr),
  adrDraftDir: protocolRelativePath(protocolDirectoryNames.adr, protocolDirectoryNames.adrDraft),
  scriptsDir: protocolRelativePath(protocolDirectoryNames.scripts),
  verifySh: protocolRelativePath(protocolDirectoryNames.scripts, protocolScriptNames.verifySh),
  verifyPs1: protocolRelativePath(protocolDirectoryNames.scripts, protocolScriptNames.verifyPs1),
} as const;

export interface ProtocolPaths {
  readonly workspaceRoot: string;
  readonly louisgoDir: string;
  readonly mission: string;
  readonly roadmap: string;
  readonly handoff: string;
  readonly handoffDraft: string;
  readonly quickSave: string;
  readonly blocker: string;
  readonly confirmReq: string;
  readonly capabilities: string;
  readonly testResults: string;
  readonly adrDir: string;
  readonly adrDraftDir: string;
  readonly scriptsDir: string;
  readonly verifySh: string;
  readonly verifyPs1: string;
}

export function createProtocolPaths(workspaceRoot: string): ProtocolPaths {
  const root = resolve(workspaceRoot);

  return {
    workspaceRoot: root,
    louisgoDir: absoluteProtocolPath(root),
    mission: absoluteProtocolPath(root, protocolFileNames.mission),
    roadmap: absoluteProtocolPath(root, protocolFileNames.roadmap),
    handoff: absoluteProtocolPath(root, protocolFileNames.handoff),
    handoffDraft: absoluteProtocolPath(root, protocolFileNames.handoffDraft),
    quickSave: absoluteProtocolPath(root, protocolFileNames.quickSave),
    blocker: absoluteProtocolPath(root, protocolFileNames.blocker),
    confirmReq: absoluteProtocolPath(root, protocolFileNames.confirmReq),
    capabilities: absoluteProtocolPath(root, protocolFileNames.capabilities),
    testResults: absoluteProtocolPath(root, protocolFileNames.testResults),
    adrDir: absoluteProtocolPath(root, protocolDirectoryNames.adr),
    adrDraftDir: absoluteProtocolPath(
      root,
      protocolDirectoryNames.adr,
      protocolDirectoryNames.adrDraft,
    ),
    scriptsDir: absoluteProtocolPath(root, protocolDirectoryNames.scripts),
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
