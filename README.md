# LouisGo

LouisGo 是一个轻量级 AI 编程 Harness。它把 AI 编程会话中的任务、验证、暂停、确认请求和交接状态落到仓库内的 `.louisgo/` 文件协议里，让状态可以恢复、事实可以验证、交接可以审阅。

## 当前状态

MVP 代码能力和本地发布准备已经完成，当前可以在本仓库或其他 Git 项目中试用 LouisGo。

已实现的 CLI：

```text
louisgo init
louisgo status
louisgo verify
louisgo pause
louisgo finish
louisgo handoff promote
louisgo codex setup
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
louisgo codex setup
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
| `louisgo codex setup` | 安装 Codex skill 和 AGENTS 指令块，让 `$start` 等指令映射到 LouisGo CLI。 |

默认验证脚本不会假装项目已通过检查；它会写入 `skipped`。要让 `louisgo verify` 变成真实质量门禁，请按项目情况编辑：

```text
.louisgo/scripts/verify.sh
.louisgo/scripts/verify.ps1
```

## AI 开发者标准用法

如果你是在 Codex 里工作的 AI 开发者，优先使用 `$` 指令；如果你在普通终端或其他工具里工作，使用对应的 `louisgo` CLI。两者作用相同：`$` 指令负责让 Codex 明确进入 LouisGo 工作流，CLI 负责真正读写 `.louisgo/` 协议文件。

第一次在仓库启用 LouisGo：

```text
louisgo init
louisgo codex setup
```

`louisgo init` 会创建 `.louisgo/` 协议文件。`louisgo codex setup` 会安装 Codex skills，并在全局和当前项目的 `AGENTS.md` 中写入 LouisGo 指令块。新开 Codex 会话或重启 Codex 后，输入 `$start`、`$pause`、`$finish` 等指令时，Codex CLI 会显示对应提示，并按 LouisGo skill 执行对应 CLI 流程。

在开发 LouisGo 自身时，如果已经构建出 `./dist/cli.js`，Codex 指令会优先使用 `node ./dist/cli.js <subcommand>` 跑当前本地构建，避免误用已全局安装的旧版 CLI。普通项目仍使用 `louisgo <subcommand>`。

最常见的一轮开发应该这样走：

```text
$start
# 读清楚当前任务和约束后开始改代码
$verify
# 验证 passed 且 fresh 后再汇报结果
$finish
# 用户审阅 HANDOFF_DRAFT.md，确认后再执行
$handoff-promote
```

按场景选择指令：

| 场景 | 在 Codex 中输入 | 普通终端命令 | 预期效果 | 下一步 |
| --- | --- | --- | --- | --- |
| 新会话、接手仓库、准备开始写代码 | `$start` | `louisgo status` | 读取协议完整性、当前任务、验证状态、恢复来源，并提示是否有 `CONFIRM_REQ`、`QUICK_SAVE` 或 `HANDOFF`。 | 先按当前任务和约束行动，不要凭聊天记忆直接开改。 |
| 只是想确认现在能不能继续 | `$status` | `louisgo status` | 快速看到当前任务、验证是否过期、是否存在确认请求或交接文件。 | 如果有确认请求，先处理确认；如果验证过期，后续需要重新验证。 |
| 做完一组代码改动，准备向用户汇报 | `$verify` | `louisgo verify` | 运行仓库验证脚本，写入 `test-results.json`，并判断结果是否对应当前工作区。 | 只有 `passed` 且 `fresh` 才能当作“当前代码已验证”。 |
| 验证结果是 `skipped`、`missing` 或 `stale` | `$verify` | `louisgo verify` | 明确告诉你验证不可作为当前事实。 | 配好 `.louisgo/scripts/verify.sh` 或 `.ps1` 后重跑验证。 |
| 要暂时停下来，稍后还会继续 | `$pause` | `louisgo pause` | 写入 `QUICK_SAVE.md`，保存短时恢复点。 | 下次回来用 `$resume` 或 `$start`。 |
| 会话中断后回来，或另一个 AI 接手 | `$resume` | `louisgo status` | 优先按正式 `HANDOFF.md` 恢复；没有交接时回到当前协议状态。 | 先确认恢复来源，再继续当前任务。 |
| 当前任务阶段完成，需要交接给用户或下一个 AI | `$finish` | `louisgo finish` | 生成 `HANDOFF_DRAFT.md`，整理验证状态，并清理临时恢复文件。 | 请用户审阅草稿，不要直接把草稿当正式交接。 |
| 用户确认交接草稿没问题 | `$handoff-promote` | `louisgo handoff promote` | 把 `HANDOFF_DRAFT.md` 提升为正式 `HANDOFF.md`。 | 后续 `$resume` 会优先使用这份正式交接。 |

最简单的判断规则：

- 开始工作先用 `$start`。
- 改完代码先用 `$verify`。
- 临时离开用 `$pause`。
- 中断回来用 `$resume`。
- 阶段收尾用 `$finish`，用户确认后用 `$handoff-promote`。
- 状态不确定时用 `$status`。

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
