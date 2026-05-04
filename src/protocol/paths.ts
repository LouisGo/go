import { join, posix, resolve } from "node:path";

export const louisgoDirectoryName = ".louisgo";

export const protocolFileNames = {
  mission: "MISSION.md",
  roadmap: "ROADMAP.md",
  state: "STATE.md",
  memory: "MEMORY.md",
  handoff: "HANDOFF.md",
  handoffDraft: "HANDOFF_DRAFT.md",
  quickSave: "QUICK_SAVE.md",
  blocker: "BLOCKER.md",
  confirmReq: "CONFIRM_REQ.md",
  runLog: "RUNLOG.md",
  capabilities: "CAPABILITIES.md",
  testResults: "test-results.json",
  gitignore: ".gitignore",
} as const;

export const protocolDirectoryNames = {
  adr: "ADR",
  adrDraft: "draft",
  memory: "memory",
  sessions: "sessions",
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
  state: protocolRelativePath(protocolFileNames.state),
  memory: protocolRelativePath(protocolFileNames.memory),
  handoff: protocolRelativePath(protocolFileNames.handoff),
  handoffDraft: protocolRelativePath(protocolFileNames.handoffDraft),
  quickSave: protocolRelativePath(protocolFileNames.quickSave),
  blocker: protocolRelativePath(protocolFileNames.blocker),
  confirmReq: protocolRelativePath(protocolFileNames.confirmReq),
  runLog: protocolRelativePath(protocolFileNames.runLog),
  capabilities: protocolRelativePath(protocolFileNames.capabilities),
  testResults: protocolRelativePath(protocolFileNames.testResults),
  gitignore: protocolRelativePath(protocolFileNames.gitignore),
  adrDir: protocolRelativePath(protocolDirectoryNames.adr),
  adrDraftDir: protocolRelativePath(protocolDirectoryNames.adr, protocolDirectoryNames.adrDraft),
  memoryDir: protocolRelativePath(protocolDirectoryNames.memory),
  sessionsDir: protocolRelativePath(protocolDirectoryNames.sessions),
  scriptsDir: protocolRelativePath(protocolDirectoryNames.scripts),
  verifySh: protocolRelativePath(protocolDirectoryNames.scripts, protocolScriptNames.verifySh),
  verifyPs1: protocolRelativePath(protocolDirectoryNames.scripts, protocolScriptNames.verifyPs1),
} as const;

export interface ProtocolPaths {
  readonly workspaceRoot: string;
  readonly louisgoDir: string;
  readonly mission: string;
  readonly roadmap: string;
  readonly state: string;
  readonly memory: string;
  readonly handoff: string;
  readonly handoffDraft: string;
  readonly quickSave: string;
  readonly blocker: string;
  readonly confirmReq: string;
  readonly runLog: string;
  readonly capabilities: string;
  readonly testResults: string;
  readonly gitignore: string;
  readonly adrDir: string;
  readonly adrDraftDir: string;
  readonly memoryDir: string;
  readonly sessionsDir: string;
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
    state: absoluteProtocolPath(root, protocolFileNames.state),
    memory: absoluteProtocolPath(root, protocolFileNames.memory),
    handoff: absoluteProtocolPath(root, protocolFileNames.handoff),
    handoffDraft: absoluteProtocolPath(root, protocolFileNames.handoffDraft),
    quickSave: absoluteProtocolPath(root, protocolFileNames.quickSave),
    blocker: absoluteProtocolPath(root, protocolFileNames.blocker),
    confirmReq: absoluteProtocolPath(root, protocolFileNames.confirmReq),
    runLog: absoluteProtocolPath(root, protocolFileNames.runLog),
    capabilities: absoluteProtocolPath(root, protocolFileNames.capabilities),
    testResults: absoluteProtocolPath(root, protocolFileNames.testResults),
    gitignore: absoluteProtocolPath(root, protocolFileNames.gitignore),
    adrDir: absoluteProtocolPath(root, protocolDirectoryNames.adr),
    adrDraftDir: absoluteProtocolPath(
      root,
      protocolDirectoryNames.adr,
      protocolDirectoryNames.adrDraft,
    ),
    memoryDir: absoluteProtocolPath(root, protocolDirectoryNames.memory),
    sessionsDir: absoluteProtocolPath(root, protocolDirectoryNames.sessions),
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
