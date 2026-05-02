# LouisGo

LouisGo 是一个轻量级 AI 编程 Harness。它把 AI 编程会话中的任务、验证、暂停、确认请求和交接状态落到仓库内的 `.louisgo/` 文件协议里，让状态可以恢复、事实可以验证、交接可以审阅。

## 当前状态

MVP 代码能力已经完成，当前建议继续 `docs/06-roadmap.md` 的 T024，完成发布准备。

已实现的 CLI：

```text
louisgo init
louisgo status
louisgo verify
louisgo pause
louisgo finish
louisgo handoff promote
```

## 安装

发布后推荐使用：

```text
npx louisgo init
```

或全局安装：

```text
npm install -g louisgo
louisgo init
```

本仓库本地开发时可先构建再运行：

```text
pnpm install
pnpm build
node dist/cli.js --help
```

## 快速开始

在任意已初始化 Git 的项目中运行：

```text
louisgo init
louisgo status
louisgo verify
louisgo pause
louisgo finish
louisgo handoff promote
```

命令含义：

| 命令 | 作用 |
| --- | --- |
| `louisgo init` | 创建 `.louisgo/` 协议目录、模板文件和验证脚本。 |
| `louisgo status` | 查看协议完整性、当前任务、验证状态、恢复来源、确认请求和 ADR 草稿。 |
| `louisgo verify` | 运行 `.louisgo/scripts/verify.sh` 或 `.louisgo/scripts/verify.ps1`，写入 `test-results.json`。 |
| `louisgo pause` | 写入 `QUICK_SAVE.md`，保存短时恢复点。 |
| `louisgo finish` | 生成 `HANDOFF_DRAFT.md`，并把 `QUICK_SAVE.md` / `CONFIRM_REQ.md` 转存后清理。 |
| `louisgo handoff promote` | 将用户认可的 `HANDOFF_DRAFT.md` 提升为正式 `HANDOFF.md`。 |

默认验证脚本不会假装项目已通过检查；它会写入 `skipped`。要让 `louisgo verify` 变成真实质量门禁，请按项目情况编辑：

```text
.louisgo/scripts/verify.sh
.louisgo/scripts/verify.ps1
```

## 工作流指令

对话中的 `$start`、`$pause`、`$resume`、`$finish` 是 AI 工作流指令；CLI 是这些指令背后的稳定文件操作。

| 指令 | 推荐 CLI / 行为 |
| --- | --- |
| `$start` | 运行 `louisgo status`，读取 `MISSION.md`、`CAPABILITIES.md`、恢复来源和当前任务。 |
| `$pause` | 运行 `louisgo pause`，保存短时恢复点。 |
| `$resume` | 运行 `louisgo status`，优先查看正式 `HANDOFF.md` 恢复状态。 |
| `$finish` | 运行 `louisgo finish`，审阅草稿后运行 `louisgo handoff promote`。 |

## `.louisgo/` 文件

主要文件说明：

| 路径 | 作用 |
| --- | --- |
| `.louisgo/MISSION.md` | 项目目标、约束、确认规则和 ADR 规则。 |
| `.louisgo/ROADMAP.md` | 稳定任务 ID 形式的任务路线图。 |
| `.louisgo/CAPABILITIES.md` | 当前仓库可用的验证入口和行为约定。 |
| `.louisgo/BLOCKER.md` | 阻塞、失败和需要用户注意的事实记录。 |
| `.louisgo/QUICK_SAVE.md` | `pause` 写入的短时恢复点。 |
| `.louisgo/CONFIRM_REQ.md` | 未解决的确认请求，存在时应优先处理。 |
| `.louisgo/HANDOFF_DRAFT.md` | `finish` 生成的交接草稿。 |
| `.louisgo/HANDOFF.md` | 用户确认后的正式恢复点。 |
| `.louisgo/test-results.json` | 验证脚本写入的机器可检查结果。 |
| `.louisgo/ADR/draft/` | 架构决策草稿目录。 |

完整协议见 [Harness 文件协议](docs/04-harness-protocol.md)。

## 验证状态

LouisGo 用 `test-results.json`、Git HEAD 和 `diff_hash` 判断验证结果是否仍然对应当前工作区。常见状态：

| 状态 | 含义 |
| --- | --- |
| `passed` | 验证通过且结果新鲜。 |
| `failed` | 验证脚本运行失败或项目检查失败。 |
| `skipped` | 验证脚本明确跳过，不能当作通过。 |
| `missing` | 尚无验证结果。 |
| `stale` | 验证结果已过期，当前工作区和验证时不一致。 |

`pause`、`finish`、`handoff promote` 会写入协议文件，因此可能让上一轮验证结果变为 `stale`。这是为了避免把旧验证结果误认为当前事实。

## MVP 限制

- 只支持单仓库、单主 AI 会话。
- 不替代 Git、CI 或项目已有测试工具。
- 不要求项目使用特定语言、框架或包管理器。
- 不实现后台服务、多 Agent 调度、worktree 合并或 PR 自动化。
- Windows MVP 只保证 PowerShell 验证脚本和基础 CLI 可用，不承诺终端体验完全一致。
- AI 可以触发验证，但不能用自述总结替代验证结果或用户确认。

## 开发命令

```text
pnpm format:check
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
```

文档入口：

- [项目总览](docs/00-overview.md)
- [MVP 产品需求](docs/01-requirements.md)
- [Harness 文件协议](docs/04-harness-protocol.md)
- [MVP 路线图](docs/06-roadmap.md)
