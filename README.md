# LouisGo

LouisGo 是一个轻量级 AI 编程工作流 Harness。它把项目规则、当前状态、滚动记忆、验证结果和正式交接放进仓库内的 `.louisgo/` 协议目录，让新的 AI 会话可以从项目文件恢复上下文，而不是依赖聊天记录。

## 核心使用方式

日常用户只需要记住三个入口：

```text
npx louisgo init
$start
$finish
```

实际心智模型：

| 入口 | 什么时候用 | 效果 |
| --- | --- | --- |
| `louisgo init` | 一个项目第一次启用 LouisGo | 创建 `.louisgo/` 协议文件，并安装 Codex 相关 skill 与 `AGENTS.md` 指令块。 |
| `$start` | 首次深度建档、上下文失真、或用户明确要求重新开始 | 读取正式交接、当前状态、项目记忆、任务和验证状态，形成上下文包。 |
| 自然对话 | 日常开发 | AI 按 `AGENTS.md` 自动读取 LouisGo 上下文，不要求每个新会话都重新 `$start`。 |
| `$finish` | 阶段完成、准备交接或换会话 | 更新正式 `HANDOFF.md`，清理短期状态，并记录验证和遗留问题。 |

`status`、`verify`、`pause`、`handoff promote`、`codex setup` 仍保留给 AI、调试和兼容场景，但不再是普通用户的主路径。

保留命令的完整形式是 `louisgo status`、`louisgo verify`、`louisgo pause`、`louisgo handoff promote` 和 `louisgo codex setup`。

## 安装

发布后推荐在目标仓库运行：

```text
npx louisgo init
```

本仓库开发：

```text
pnpm install
pnpm build
node dist/cli.js --help
```

## `.louisgo/` 协议

初始化后核心文件如下：

| 路径 | 作用 |
| --- | --- |
| `.louisgo/MISSION.md` | 项目目标、约束、确认规则和默认模式。 |
| `.louisgo/CAPABILITIES.md` | 当前仓库可用验证入口和 AI 行为约定。 |
| `.louisgo/STATE.md` | 当前工作状态，新的 AI 会话优先读取。 |
| `.louisgo/MEMORY.md` | 滚动记忆索引，记录长期上下文和主题文件。 |
| `.louisgo/memory/` | 可按主题扩展的长期记忆目录。 |
| `.louisgo/sessions/` | 单次会话摘要目录，按需追溯。 |
| `.louisgo/HANDOFF.md` | 正式交接快照；存在时优先于普通记忆。 |
| `.louisgo/ROADMAP.md` | 稳定任务 ID 形式的任务路线图。 |
| `.louisgo/BLOCKER.md` | 阻塞、失败和需要用户注意的事实记录。 |
| `.louisgo/CONFIRM_REQ.md` | 未解决的确认请求；存在时必须优先处理。 |
| `.louisgo/test-results.json` | 验证脚本写入的机器可检查结果。 |
| `.louisgo/scripts/verify.sh` | macOS / Linux 验证入口。 |
| `.louisgo/scripts/verify.ps1` | Windows 验证入口。 |

恢复优先级：

```text
HANDOFF.md -> STATE.md -> MEMORY.md -> memory/*.md -> sessions/*.md -> 源码/Git/验证结果
```

`HANDOFF.md` 是正式交接，适合阶段收尾和换人接手；`STATE.md` / `MEMORY.md` 是日常滚动记忆，解决“没有 finish 就新开会话会失忆”的问题。

## Codex 集成

`louisgo init` 默认安装 Codex 集成：

- 在当前仓库和 Codex Home 写入 LouisGo `AGENTS.md` 指令块。
- 安装 `$start`、`$finish` 等 Codex skills。
- 指示 AI 在普通新会话中自动读取 `.louisgo/HANDOFF.md`、`.louisgo/STATE.md` 和 `.louisgo/MEMORY.md`。

如果只需要重新安装 Codex 集成，可运行：

```text
louisgo codex setup
```

## 验证

LouisGo 不替代项目测试工具。它只提供统一入口：

```text
louisgo verify
```

默认验证脚本会写入 `skipped`，不会伪装为通过。要让验证成为真实质量门禁，请按项目情况编辑：

```text
.louisgo/scripts/verify.sh
.louisgo/scripts/verify.ps1
```

验证状态：

| 状态 | 含义 |
| --- | --- |
| `passed` | 验证通过且结果新鲜。 |
| `failed` | 项目检查失败。 |
| `error` | 验证流程本身出错。 |
| `skipped` | 验证被跳过，不能当作通过。 |
| `missing` | 尚无验证结果。 |
| `stale` | 验证结果已过期，不能代表当前工作区。 |

## 开发命令

```text
pnpm format:check
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
```

## 文档

文档只保留核心契约：

- [项目总览](docs/00-overview.md)
- [产品主路径](docs/01-product.md)
- [文件协议](docs/02-protocol.md)
- [路线图](docs/03-roadmap.md)
