---
schema: louisgo-mission-v1
default_mode: assist
updated_at: "2026-05-03T13:23:31.000Z"
---

# Mission

## Goal

- LouisGo 是 Git 可同步的 prompt 智能缓存和 context compiler，服务 AI 编程的恢复、验证和交接。
- 日常入口保持极简：`$init` 建好项目协议和 AI 集成，`$start` 恢复上下文，`$finish` 生成正式交接。
- 新会话即使没有 handoff，也应能通过 `louisgo context` 从项目契约、稳定记忆和活跃状态重建必要语境。

## Constraints

- 使用 Node.js >= 20、TypeScript、commander、zod、gray-matter、tsup 和 vitest。
- 包名为 `louisgo`，CLI 入口为 `dist/cli.js`。
- 协议文件使用 Markdown + YAML front matter；默认上下文必须短、可读、可 diff、可提交。
- 不引入后台服务、向量库或重型外部记忆，除非用户明确确认方向变化。
- 用户本轮 prompt 永远优先；LouisGo 只提供带来源、带预算、可截断的上下文前缀。
- 源码、Git 状态和验证结果优先于记忆文件；记忆只能辅助，不可替代事实检查。

## Confirm First

- npm 发布、许可证、包名、公开协议破坏性变更、大范围重构。
- 引入外部模型调用、云同步、数据库、向量检索或后台常驻服务。
- 两种以上明显可行方向，或用户指令与本文件冲突。

## Decision Records

- 公开 API、持久化格式、关键依赖、跨模块边界变更：先写 `.louisgo/ADR/draft/`。
- ADR 草稿经用户确认后，才能成为正式 ADR。
