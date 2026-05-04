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

- Describe the project goal in 1-3 durable bullets.
- LouisGo keeps AI coding context in Git so new sessions can recover without chat history.

## Constraints

- Record stable stack, naming, compatibility, release, and security constraints here.
- User prompts override cached context; source, Git, and verification facts override memory.

## Confirm First

- 发布、许可证、包名、公开协议破坏性变更、大范围重构。
- 两种以上明显可行方向，或指令与本文件冲突。

## Decision Records

- 公开 API、持久化格式、关键依赖、跨模块边界变更：先写 \`.louisgo/ADR/draft/\`。
`;
}
