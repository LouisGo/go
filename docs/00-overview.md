# 项目总览

## 作用

本文是 LouisGo 项目的文档入口和 AI 读取指针。

目标：

- 让人快速理解项目当前状态。
- 让 AI 按任务读取必要文档，避免每次全量分析。
- 让后续开发从明确的任务入口开始。

## 项目定位

LouisGo 是一个轻量级 AI 编程 Harness。

MVP 目标不是构建完整 Agent 平台，而是提供一套仓库内协议和 CLI，让 AI 编程会话具备：

- 可恢复的上下文。
- 可验证的事实来源。
- 可审阅的正式交接。
- 可见的 AI 自主模式。
- 可见的歧义确认请求。
- 可审阅的架构决策草稿。

## 当前阶段

当前处于 MVP 代码实现阶段，已完成 T001-T024。

已完成：

- 产品需求
- 技术选型
- 整体架构草案
- `.louisgo/` 文件协议
- MVP 任务拆分
- MVP 路线图
- 开放问题
- 决策日志
- Node.js + TypeScript 工程骨架
- 代码质量基础
- 协议路径和工作区定位
- 核心协议 schema
- Markdown Front Matter 读写
- 安全写入
- ROADMAP 解析
- `.louisgo/` 初始文件模板生成
- `louisgo init`
- 协议完整性检查
- `louisgo status`
- Git 基础能力
- `diff_hash`
- 验证结果读写和新鲜度判断
- 验证脚本运行器
- `louisgo verify`
- QUICK_SAVE 和 CONFIRM_REQ 协议读写
- `louisgo pause`
- HANDOFF_DRAFT 生成
- `louisgo finish`
- `louisgo handoff promote`
- CLI 端到端测试
- README 和使用说明
- npm 发布准备

## 核心决策摘要

- 协议目录使用 `.louisgo/`。
- 文档和代码注释默认使用简体中文。
- 显式工作流指令使用 `$` 前缀。
- 自主模式使用 `auto`、`assist`、`manual`。
- MVP 只服务单仓库、单主 AI 会话。
- 技术栈使用 Node.js + TypeScript。
- 包名使用 `louisgo`。
- CLI 从 `louisgo init` 开始。
- 协议文件使用 Markdown + Front Matter。
- 路线图任务必须使用稳定任务 ID。
- 验证结果必须能判断是否过期。
- `HANDOFF.md` 由草稿提升生成，不强制验证状态为 `passed`。
- `CONFIRM_REQ.md` 进入 MVP 协议，用于承载未解决确认请求。
- `.louisgo/ADR/draft/` 进入 MVP 协议，用于承载架构决策草稿。
- 生产者可以触发验证，但不能判定自身产出质量。

详细原因见 `docs/08-decision-log.md`。

## 文档地图

| 文档 | 作用 | 什么时候读 |
| --- | --- | --- |
| `README.md` | 项目对外入口。 | 第一次了解项目时读。 |
| `docs/00-overview.md` | 文档导航和 AI 读取指针。 | 每次新会话或不确定该读什么时读。 |
| `docs/01-requirements.md` | MVP 产品需求和边界。 | 讨论需求、范围、指令、模式时读。 |
| `docs/02-technology-selection.md` | 技术选型和依赖策略。 | 讨论 Node.js、TypeScript、依赖、分发时读。 |
| `docs/03-architecture.md` | 整体架构和模块边界。 | 开始写代码、调整目录、设计模块时读。 |
| `docs/04-harness-protocol.md` | `.louisgo/` 文件协议。 | 实现协议读写、模板、验证、handoff 时读。 |
| `docs/05-task-breakdown.md` | 详细任务拆分。 | 实现具体任务前读对应任务。 |
| `docs/06-roadmap.md` | 简洁执行路线图。 | 选择下一个任务或更新任务状态时读。 |
| `docs/07-open-questions.md` | 尚未定案的问题。 | 遇到未决设计点时读。 |
| `docs/08-decision-log.md` | 已确认决策日志。 | 遇到“为什么这样设计”时读。 |

## AI 按需读取策略

AI 不应默认读取所有文档。

推荐流程：

1. 先读 `docs/00-overview.md`。
2. 再读 `docs/06-roadmap.md`，确认当前任务。
3. 按任务 ID 到 `docs/05-task-breakdown.md` 读取对应任务细节。
4. 只在需要时读取相关设计文档。
5. 如果出现设计冲突，优先读取 `docs/08-decision-log.md`。
6. 如果问题没有定案，读取 `docs/07-open-questions.md`。

## 按任务类型读取

### 判断下一步做什么

读取：

- `docs/00-overview.md`
- `docs/06-roadmap.md`

通常不需要读取：

- `docs/03-architecture.md`
- `docs/04-harness-protocol.md`
- `docs/05-task-breakdown.md`

### 实现 T001-T002：项目基础

读取：

- `docs/06-roadmap.md`
- `docs/05-task-breakdown.md` 中 T001-T002
- `docs/02-technology-selection.md`
- `docs/03-architecture.md` 的推荐项目结构

通常不需要读取：

- `docs/04-harness-protocol.md` 全文

### 实现 T003-T007：协议模型和文件读写

读取：

- `docs/05-task-breakdown.md` 中 T003-T007
- `docs/04-harness-protocol.md`
- `docs/03-architecture.md` 的协议层设计
- `docs/08-decision-log.md` 中 D008-D011、D017-D018

### 实现 T008-T011：脚手架和状态检查

读取：

- `docs/05-task-breakdown.md` 中 T008-T011
- `docs/04-harness-protocol.md`
- `docs/03-architecture.md` 中 `louisgo init` 和 `louisgo status`
- `docs/08-decision-log.md` 中 D012、D016-D018

### 实现 T012-T016：Git、diff hash 和验证

读取：

- `docs/05-task-breakdown.md` 中 T012-T016
- `docs/03-architecture.md` 中 `diff_hash` 设计和验证流程
- `docs/04-harness-protocol.md` 中 `test-results.json`
- `docs/08-decision-log.md` 中 D010-D013、D019

### 实现 T017-T021：会话工作流命令

读取：

- `docs/05-task-breakdown.md` 中 T017-T021
- `docs/04-harness-protocol.md` 中 `QUICK_SAVE.md`、`CONFIRM_REQ.md`、`HANDOFF_DRAFT.md`、`HANDOFF.md`、ADR
- `docs/03-architecture.md` 中 `pause`、`finish`、`handoff promote`
- `docs/07-open-questions.md` 中 Q006-Q008
- `docs/08-decision-log.md` 中 D014-D015、D017-D018

注意：

- T017-T021 前需要先确认 Q006-Q008。

### 实现 T022-T024：测试、文档和发布

读取：

- `docs/05-task-breakdown.md` 中 T022-T024
- `docs/02-technology-selection.md` 的分发方式
- `docs/03-architecture.md` 的测试策略
- `docs/07-open-questions.md` 中 Q001-Q002

## 文档优先级

如果文档之间出现冲突，按以下顺序判断：

1. `docs/08-decision-log.md`
2. `docs/01-requirements.md`
3. `docs/04-harness-protocol.md`
4. `docs/03-architecture.md`
5. `docs/05-task-breakdown.md`
6. `docs/06-roadmap.md`
7. `docs/07-open-questions.md`

说明：

- 决策日志代表已确认取舍。
- 需求文档代表产品边界。
- 协议文档代表文件契约。
- 架构文档代表实现建议。
- 任务拆分和路线图服务执行，若和上层设计冲突，应回到上层文档修正。

## 当前开发入口

当前下一步任务：

```text
P5 已完成；下一步进行人工试用、版本号确认和真实 npm 发布决策。
```

继续发布前建议读取：

- `README.md` 中使用说明
- `docs/02-technology-selection.md` 的分发方式
- `docs/07-open-questions.md` 中 Q001-Q002
- `docs/06-roadmap.md`

## 给 AI 的执行约束

- 不要在没有需求时全量读取所有文档。
- 不要跳过任务依赖顺序。
- 不要把未决问题当成已确认决策。
- 修改文档后要检查旧路径、旧指令和旧模式命名是否残留。
- 完成任务后要给出明确下一步建议。
