import type { ProtocolStatus, RecoverySource } from "../services/status-service.js";

export function formatStatusReport(status: ProtocolStatus): string {
  const mode = status.mode ?? "unknown";
  const completeness = status.complete ? "协议完整" : "协议不完整";
  const currentTask = status.currentTask?.id ?? "无";
  const phaseLabel = formatPhaseLabel(status.phase);
  const lines = [
    `[${mode}/${phaseLabel}] ${completeness}，当前任务 ${currentTask}，验证状态 ${status.verificationStatus}，恢复来源 ${formatRecoverySource(
      status.recoverySource,
    )}。`,
  ];

  lines.push(formatWorkspaceLine(status));

  if (status.hasConfirmReq) {
    lines.push(
      "存在未解决确认请求：运行 louisgo confirm 查看选项，或打开 .louisgo/CONFIRM_REQ.md。",
    );
  }

  if (status.adrDrafts.length > 0) {
    lines.push(`存在 ADR 草稿：${status.adrDrafts.length} 个。`);
  }

  if (status.issues.length > 0) {
    lines.push("需要处理的问题：");
    for (const issue of status.issues) {
      lines.push(`- ${issue.relativePath}：${issue.message}`);
    }
    lines.push("下一步：运行 louisgo init 创建缺失文件，或按上方路径修复协议内容。");
  } else if (!status.workspace.clean) {
    lines.push(formatWorkspaceNextStep(status));
  }

  return `${lines.join("\n")}\n`;
}

function formatWorkspaceLine(status: ProtocolStatus): string {
  if (status.workspace.clean) {
    return "工作区：clean。";
  }

  const untracked =
    status.workspace.untrackedFiles > 0 ? `，其中 ${status.workspace.untrackedFiles} 个未跟踪` : "";
  const samples =
    status.workspace.samplePaths.length > 0
      ? `：${status.workspace.samplePaths.join("，")}${status.workspace.changedFiles > status.workspace.samplePaths.length ? "，..." : ""}`
      : "。";

  return `工作区：${status.workspace.changedFiles} 个待处理变更${untracked}${samples}`;
}

function formatWorkspaceNextStep(status: ProtocolStatus): string {
  if (status.verificationStatus === "passed") {
    if (status.recoverySource === "handoff") {
      return "下一步：HANDOFF 已更新；提交或同步当前 diff 后即可在新会话继续。";
    }

    return "下一步：如果这些 diff 就是当前成果，运行 $finish 固化交接；提交前按项目策略处理 Git diff。";
  }

  if (status.verificationStatus === "missing" || status.verificationStatus === "skipped") {
    return "下一步：如果只是初始化 LouisGo，提交 .louisgo/ 和 AGENTS.md；进入真实开发前配置项目验证命令。";
  }

  return "下一步：完成当前改动后运行 louisgo verify，再用 $finish 固化交接。";
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
      return "无";
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
