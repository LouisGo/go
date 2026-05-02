export interface CapabilitiesTemplateOptions {
  readonly updatedAt: string;
}

export function createCapabilitiesTemplate(options: CapabilitiesTemplateOptions): string {
  return `---
schema: louisgo-capabilities-v1
updated_at: "${options.updatedAt}"
---

# Capabilities

## 验证

- macOS / Linux 命令：\`.louisgo/scripts/verify.sh\`
- Windows 命令：\`.louisgo/scripts/verify.ps1\`
- 结果：\`.louisgo/test-results.json\`

## 行为约定

- 面向用户的状态提示必须包含当前模式。
- 普通新会话优先读取 \`.louisgo/HANDOFF.md\`、\`.louisgo/STATE.md\` 和 \`.louisgo/MEMORY.md\`。
- 需要用户确认时，写入 \`.louisgo/CONFIRM_REQ.md\`。
- 涉及架构决策时，写入 \`.louisgo/ADR/draft/\`。
- 阶段收尾时，\`louisgo finish\` 更新正式 \`.louisgo/HANDOFF.md\`。
`;
}
