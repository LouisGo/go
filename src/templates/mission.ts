export interface MissionTemplateOptions {
  readonly updatedAt: string;
}

export function createMissionTemplate(options: MissionTemplateOptions): string {
  return `---
schema: louisgo-mission-v1
default_mode: assist
updated_at: "${options.updatedAt}"
---

# Mission

## 项目目标

## 技术约束

## 禁止事项

## 确认规则

## ADR 规则

- 涉及公开 API、数据模型、新技术栈或跨模块边界的架构决策，必须先创建 ADR 草稿。
- ADR 草稿经用户确认后，才能成为正式 ADR。
`;
}
