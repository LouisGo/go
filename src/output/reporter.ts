import type { ProtocolStatus, RecoverySource } from "../services/status-service.js";

export function formatStatusReport(status: ProtocolStatus): string {
  const mode = status.mode ?? "unknown";
  const completeness = status.complete ? "协议完整" : "协议不完整";
  const currentTask = status.currentTask?.id ?? "无";
  const lines = [
    `[${mode}] ${completeness}，当前任务 ${currentTask}，验证状态 ${status.verificationStatus}，恢复来源 ${formatRecoverySource(
      status.recoverySource,
    )}。`,
  ];

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
  }

  return `${lines.join("\n")}\n`;
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
