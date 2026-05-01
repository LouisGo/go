# LouisGo

LouisGo 是一个轻量级 AI 编程 Harness。

它的目标是在任意代码仓库中提供一套稳定的 AI 协作协议，让 AI 编程过程具备更可靠的上下文恢复、验证事实和交接状态。

## 当前状态

项目已进入 MVP 代码实现阶段。

当前已经完成基础 CLI 入口、Node.js + TypeScript 工程骨架、质量检查基础，以及协议路径、schema、Front Matter 读写、安全写入和 ROADMAP 解析。

`louisgo init`、`louisgo status` 等业务命令尚未实现。

当前已经完成：

- MVP 产品需求
- 技术选型
- 整体架构草案
- `.louisgo/` 文件协议
- MVP 任务拆分
- 执行路线图
- 开放问题列表
- 决策日志
- Node.js + TypeScript 工程骨架
- 基础 CLI 入口
- 协议模型和文件读写基础

## 核心方向

LouisGo 的 MVP 不是 Agent 平台，也不是测试框架。

MVP 只聚焦一个问题：

> 让 AI 编程会话的状态可恢复、可验证、可交接。

核心机制：

- 使用 `.louisgo/` 目录保存 AI 协作协议文件。
- 使用 `auto`、`assist`、`manual` 表达 AI 自主模式。
- 使用 `$start`、`$pause`、`$resume`、`$finish` 表达 AI 工作流指令。
- 使用 `test-results.json`、Git HEAD 和 `diff_hash` 判断验证结果是否新鲜。
- 使用 `HANDOFF_DRAFT.md` 和 `HANDOFF.md` 区分 AI 草稿与用户确认状态。
- 使用 `CONFIRM_REQ.md` 让歧义确认可见、可恢复。
- 使用 `ADR/draft/` 和正式 ADR 记录架构决策门禁。
- 允许 AI 触发验证，但不允许 AI 用自述替代验证或用户确认。

## 技术栈

MVP 采用：

- Node.js >= 20
- TypeScript
- npm / npx 分发

计划使用：

- `commander`
- `zod`
- `gray-matter`
- `execa`
- `tsup`
- `vitest`

## 文档入口

请先阅读：

- [项目总览](docs/00-overview.md)

如果只想知道项目要做什么：

- [MVP 产品需求](docs/01-requirements.md)

如果要开始实现：

- [MVP 路线图](docs/06-roadmap.md)
- [MVP 任务拆分](docs/05-task-breakdown.md)
- [整体架构设计](docs/03-architecture.md)

如果要理解协议：

- [Harness 文件协议](docs/04-harness-protocol.md)

如果要理解为什么这样设计：

- [技术选型](docs/02-technology-selection.md)
- [决策日志](docs/08-decision-log.md)

如果要查看未决问题：

- [开放问题](docs/07-open-questions.md)

## AI 读取建议

AI 不应每次全量读取所有文档。

默认读取顺序：

1. `docs/00-overview.md`
2. 根据当前任务，按 overview 中的指针读取必要文档
3. 如遇设计疑问，再读取 `docs/08-decision-log.md`
4. 如遇未定事项，再读取 `docs/07-open-questions.md`

## 下一步

当前建议继续 `docs/06-roadmap.md` 的 T008，实现 `.louisgo/` 模板生成。
