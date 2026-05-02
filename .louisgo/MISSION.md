---
schema: louisgo-mission-v1
default_mode: assist
updated_at: "2026-05-02T06:55:00.000Z"
---

# Mission

## 项目目标

LouisGo 是一个轻量级 AI 编程 Harness，目标是在任意 Git 仓库中提供可恢复、可验证、可交接的 AI 编程工作流。

## 技术约束

- 使用 Node.js >= 20、TypeScript、commander、zod、gray-matter、tsup 和 vitest。
- 包名为 `louisgo`，CLI 入口为 `dist/cli.js`。
- 文档和面向用户的输出使用简体中文。
- 代码注释默认使用简体中文，协议标识、字段名、命令名可以使用英文。
- 代码变更应保持小步、可测试、符合现有模块边界。

## 禁止事项

- 不用 AI 自述替代验证结果或用户确认。
- 不在未确认的情况下改变协议字段语义、包名、发布路径或重大架构方向。
- 不把临时验证结果、Quick Save、Handoff Draft、Confirm Request 等易变会话状态提交为项目事实。

## 确认规则

- 涉及 npm 发布、许可证、包名、协议破坏性变更或大范围重构时，需要先向用户确认。
- 出现两种以上明显可行方向时，优先写入 `.louisgo/CONFIRM_REQ.md` 或在对话中明确请求选择。

## ADR 规则

- 涉及公开协议、持久化格式、跨模块边界或关键依赖的架构决策，必须先创建 ADR 草稿。
- ADR 草稿经用户确认后，才能成为正式 ADR。
