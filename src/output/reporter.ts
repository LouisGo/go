import type { ProtocolStatus, RecoverySource } from "../services/status-service.js";

export function formatStatusReport(status: ProtocolStatus): string {
  const mode = status.mode ?? "unknown";
  const completeness = status.complete ? "complete" : "incomplete";
  const currentTask = status.currentTask?.id ?? "none";
  const phaseLabel = formatPhaseLabel(status.phase);
  const lines = [
    `[${mode}/${phaseLabel}] ${completeness}, current task ${currentTask}, verification status ${status.verificationStatus}, recovery source ${formatRecoverySource(
      status.recoverySource,
    )}.`,
  ];

  lines.push(formatWorkspaceLine(status));

  if (status.hasConfirmReq) {
    lines.push(
      "Open confirmation request: run louisgo confirm to view options or open .louisgo/CONFIRM_REQ.md.",
    );
  }

  if (status.adrDrafts.length > 0) {
    lines.push(`ADR drafts present: ${status.adrDrafts.length}.`);
  }

  if (status.issues.length > 0) {
    lines.push("Issues to fix:");
    for (const issue of status.issues) {
      lines.push(`- ${issue.relativePath}: ${issue.message}`);
    }
    lines.push(
      "Next: run louisgo init to create missing files, or fix the protocol content at the paths above.",
    );
  } else if (!status.workspace.clean) {
    lines.push(formatWorkspaceNextStep(status));
  }

  return `${lines.join("\n")}\n`;
}

function formatWorkspaceLine(status: ProtocolStatus): string {
  if (status.workspace.clean) {
    return "Workspace: clean.";
  }

  const untracked =
    status.workspace.untrackedFiles > 0
      ? `, including ${status.workspace.untrackedFiles} untracked`
      : "";
  const samples =
    status.workspace.samplePaths.length > 0
      ? `: ${status.workspace.samplePaths.join(", ")}${status.workspace.changedFiles > status.workspace.samplePaths.length ? ", ..." : ""}`
      : ".";

  return `Workspace: ${status.workspace.changedFiles} pending changes${untracked}${samples}`;
}

function formatWorkspaceNextStep(status: ProtocolStatus): string {
  if (status.verificationStatus === "passed") {
    if (status.recoverySource === "handoff") {
      return "Next: HANDOFF is up to date. Commit or sync the current diff, then continue in a new session.";
    }

    return "Next: if these diffs are the current result, run $finish to finalize the handoff. Handle the Git diff according to project policy before committing.";
  }

  if (status.verificationStatus === "missing" || status.verificationStatus === "skipped") {
    return "Next: if this is only LouisGo initialization, commit .louisgo/ and the project agent instruction file. Configure a real project verification command before production use.";
  }

  return "Next: finish the current changes, run louisgo verify, then use $finish to finalize the handoff.";
}

function formatRecoverySource(source: RecoverySource): string {
  switch (source) {
    case "handoff":
      return "HANDOFF";
    case "state":
      return "STATE";
    case "quick_save":
      return "QUICK_SAVE";
    case "none":
      return "none";
  }
}

function formatPhaseLabel(phase: string): string {
  switch (phase) {
    case "explore":
      return "explore";
    case "execute":
      return "execute";
    case "idle":
      return "idle";
    default:
      return phase;
  }
}
