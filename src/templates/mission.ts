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

## Goal

<!-- 用 1-3 条写清项目目标。 -->

## Constraints

<!-- 写技术栈、命名、发布、兼容性等稳定约束。 -->

## Confirm First

- 发布、许可证、包名、公开协议破坏性变更、大范围重构。
- 两种以上明显可行方向，或指令与本文件冲突。

## Decision Records

- 公开 API、持久化格式、关键依赖、跨模块边界变更：先写 \`.louisgo/ADR/draft/\`。
`;
}
