import type { Writable } from "node:stream";

import type { ProtocolStatus, RecoverySource } from "../services/status-service.js";
import { createOutputTheme, field, headline, statusIcon, statusToken, tip } from "./theme.js";

export function formatStatusReport(status: ProtocolStatus, stdout?: Writable): string {
  const theme = createOutputTheme(stdout);
  const mode = status.mode ?? "unknown";
  const completeness = status.complete ? "complete" : "incomplete";
  const currentTask = status.currentTask?.task_id ?? "none";
  const phaseLabel = formatPhaseLabel(status.phase);
  const lines = [
    `${headline(
      theme,
      status.complete ? "✅" : "⚠️",
      "LouisGo status",
    )} [${mode}/${phaseLabel}] ${completeness}, current task ${currentTask}, verification status ${status.verificationStatus}, recovery source ${formatRecoverySource(
      status.recoverySource,
    )}.`,
  ];

  lines.push(formatWorkspaceLine(status, theme));
  lines.push(
    field(
      theme,
      "Private store",
      status.privateStore.path === null
        ? "no active task"
        : `${theme.path(status.privateStore.path)} (${status.privateStore.projectKey})`,
    ),
  );

  if (status.privateTasks.length > 1) {
    lines.push(
      `${theme.warning("Multiple private tasks")}: use ${theme.command("--task <id>")} to select explicitly.`,
    );
  }

  if (status.hasConfirmReq) {
    lines.push(
      `${theme.warning("Open confirmation request")}: run ${theme.command("louisgo confirm")} to view options or open ${theme.path(".louisgo/CONFIRM_REQ.md")}.`,
    );
  }

  if (status.adrDrafts.length > 0) {
    lines.push(`${theme.warning("ADR drafts present")}: ${status.adrDrafts.length}.`);
  }

  if (status.issues.length > 0) {
    lines.push(`${theme.danger("Issues to fix")}:`);
    for (const issue of status.issues) {
      lines.push(`  ${statusIcon("failed")} ${theme.path(issue.relativePath)}: ${issue.message}`);
    }
    lines.push(
      tip(
        theme,
        `Run ${theme.command("louisgo init")} to create missing files, or fix the protocol content at the paths above.`,
      ),
    );
  } else if (!status.workspace.clean) {
    lines.push(formatWorkspaceNextStep(status, theme));
  }

  return `${lines.join("\n")}\n`;
}

function formatWorkspaceLine(status: ProtocolStatus, theme = createOutputTheme()): string {
  if (status.workspace.clean) {
    return field(theme, "Workspace", statusToken(theme, "clean"));
  }

  const untracked =
    status.workspace.untrackedFiles > 0
      ? `, including ${status.workspace.untrackedFiles} untracked`
      : "";
  const samples =
    status.workspace.samplePaths.length > 0
      ? `: ${status.workspace.samplePaths.join(", ")}${status.workspace.changedFiles > status.workspace.samplePaths.length ? ", ..." : ""}`
      : ".";

  return field(
    theme,
    "Workspace",
    `${statusToken(theme, `${status.workspace.changedFiles} pending changes`)}${untracked}${samples}`,
  );
}

function formatWorkspaceNextStep(status: ProtocolStatus, theme = createOutputTheme()): string {
  if (status.verificationStatus === "passed") {
    if (status.recoverySource === "task") {
      return tip(
        theme,
        "Private task state is up to date. Commit or sync the current diff through normal Git workflow when ready.",
      );
    }

    return tip(
      theme,
      `If these diffs are the current result, run ${theme.command("louisgo finish")} to write a private phase summary. Handle the Git diff according to project policy before committing.`,
    );
  }

  if (status.verificationStatus === "missing" || status.verificationStatus === "skipped") {
    return tip(
      theme,
      "If this is only LouisGo initialization, commit .louisgo/ and the project agent instruction file. Configure a real project verification command before production use.",
    );
  }

  return tip(
    theme,
    `Finish the current changes, run ${theme.command("louisgo verify")}, then use ${theme.command("louisgo finish")} to write a private phase summary.`,
  );
}

function formatRecoverySource(source: RecoverySource): string {
  switch (source) {
    case "task":
      return "PRIVATE_TASK";
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
