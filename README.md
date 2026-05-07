# LouisGo

LouisGo 是一个给 AI 编程使用的轻量级上下文 Harness。它把项目目标、约束、状态、记忆、验证结果和正式交接放进仓库内的 `.louisgo/`，让新的 AI 会话可以从 Git 文件恢复上下文，而不是依赖聊天记录。

## 最小闭环

普通用户只需要理解这条线：

```text
npm install -g louisgo -> louisgo init -> 自然对话开发 -> $start 按需深度恢复 -> $finish 正式交接
```

| 阶段          | 用户做什么                 | AI / CLI 做什么                                                        |
| ------------- | -------------------------- | ---------------------------------------------------------------------- |
| 安装命令      | `npm install -g louisgo`   | 让 Codex 新会话可以稳定调用 `louisgo context`、`status`、`finish`。    |
| 启用项目      | `louisgo init`             | 创建最小 `.louisgo/` 协议、验证脚本、Codex skills 和 `AGENTS.md` 入口。 |
| 日常开发      | 直接向 AI 提需求           | AI 根据 `AGENTS.md` 先运行 `louisgo context`，再读必要源码并执行任务。 |
| 按需技能      | `louisgo skill enable ...` | 仅在需要时启用预设 skill，若项目已有同名 skill 则阻止覆盖。           |
| 语境失真      | 输入 `$start`              | 重新编译上下文包，优先恢复 `HANDOFF.md -> STATE.md -> MEMORY.md`。     |
| 阶段收尾      | 输入 `$finish`             | 记录验证状态、Git diff、阻塞和下一步，生成正式 `.louisgo/HANDOFF.md`。 |
| 换机器/换会话 | 拉取 Git 后继续对话        | 新 AI 会话从 `.louisgo/` 和源码恢复必要上下文。                        |

`context`、`stats`、`skill`、`confirm`、`log`、`status`、`verify`、`pause`、`handoff promote`、`codex setup` 是 AI、高级用户和兼容场景的工具，不是日常主路径。

## 为什么有用

LouisGo 不做后台服务、数据库或向量记忆。它只缓存对 AI 编程真正有用、可审计、可提交的 prompt 材料：

- `MISSION.md`：项目目标、约束和需要先确认的事项。
- `CAPABILITIES.md`：当前项目可用命令、验证入口和 AI 行为契约。
- `STATE.md`：当前任务、验证状态和下一步。
- `MEMORY.md`：长期稳定记忆索引，不记录聊天流水账；初始不创建，形成真实记忆后再写入。
- `HANDOFF.md`：阶段完成后的正式恢复快照。
- `test-results.json`：验证事实来源。
- `.louisgo/stats/`：本地 token 和 context 观测事件，默认不提交。

核心原则是：**用户本轮 prompt 永远是任务来源；LouisGo 只提供可裁剪、带来源、不过载的上下文前缀。** 如果记忆和源码、Git、验证结果冲突，以事实为准。

## Codex 使用方式

推荐先安装全局命令：

```text
npm install -g louisgo
```

然后在目标 Git 仓库里运行：

```text
louisgo init
```

之后在 Codex 中正常提需求即可。`init` 会安装 LouisGo 的 Codex 集成，使普通新会话在改文件前先读取 `louisgo context`。

如果不想预先全局安装，也可以用一次性入口：

```text
npx --yes louisgo@latest init
```

Codex 集成生成的指令会优先使用 `louisgo <subcommand>`；当全局命令不可用时，可降级为 `npx --yes louisgo@latest <subcommand>`。

需要手动恢复时：

```text
$start
```

阶段完成时：

```text
$finish
```

如果只想检查当前协议和工作区：

```text
louisgo status
```

`status` 会报告协议完整性、当前任务、验证状态、恢复来源，以及当前 Git 工作区是否还有待处理变更。

如果要诊断 LouisGo 在另一个项目里到底有没有起作用：

```text
louisgo log --tail 30
```

也可以直接发送 `.louisgo/RUNLOG.md`。它只记录命令级事件、恢复来源、验证状态和工作区摘要，不记录用户 prompt 正文或聊天全文。

如果要看 token 和 context 观测：

```text
louisgo stats
louisgo stats import codex --days 7
```

`stats` 默认只读本项目 `.louisgo/stats/`。导入 Codex usage 必须显式运行 `stats import codex`；它只提取 Codex session JSONL 里的 token 数字，不保存 prompt、回复正文或源码。

如果要启用 LouisGo 预设 skill：

```text
louisgo skill list
louisgo skill enable grill
louisgo skill enable caveman
```

预设 skill 不会在 `init` 时默认写入项目。启用时会检查 `.codex/skills/` 和 `.louisgo/skills/` 的同名 skill，发现冲突会提示用户，不覆盖项目已有内容。

## 外部项目实验

用已发布包：

```text
cd /path/to/your/git-project
npm install -g louisgo
louisgo init
louisgo context --goal "恢复项目上下文"
louisgo verify
louisgo finish
```

用本仓库本地构建：

```text
pnpm build
cd /path/to/your/git-project
node "/Users/louistation/Documents/New project/dist/cli.js" init
node "/Users/louistation/Documents/New project/dist/cli.js" context --goal "恢复项目上下文"
node "/Users/louistation/Documents/New project/dist/cli.js" verify
node "/Users/louistation/Documents/New project/dist/cli.js" finish
```

实验目标不是让任意项目测试天然通过，而是确认 `.louisgo/` 能被创建、AI 能恢复上下文、验证结果能被记录、阶段结果能生成正式交接。

## 协议目录

| 路径                          | 作用                                                                  |
| ----------------------------- | --------------------------------------------------------------------- |
| `.louisgo/MISSION.md`         | 项目契约。                                                            |
| `.louisgo/CAPABILITIES.md`    | 能力、验证入口和 AI 行为契约。                                        |
| `.louisgo/STATE.md`           | 当前状态和下一步。                                                    |
| `.louisgo/MEMORY.md`          | 稳定记忆索引，按需创建。                                              |
| `.louisgo/HANDOFF.md`         | 正式交接快照。                                                        |
| `.louisgo/CONFIRM_REQ.md`     | 需要用户确认时的结构化信号。                                          |
| `.louisgo/RUNLOG.md`          | 本地诊断日志，默认被 `.louisgo/.gitignore` 忽略，适合调试时发送。     |
| `.louisgo/stats/`             | 本地 stats 事件和 Codex 导入索引，默认被 `.louisgo/.gitignore` 忽略。 |
| `.louisgo/ROADMAP.md`         | 需要跨会话追踪稳定任务时按需创建。                                    |
| `.louisgo/skills/`            | 按需启用的 LouisGo 预设 skill。                                       |
| `.louisgo/scripts/verify.sh`  | macOS / Linux 验证入口。                                              |
| `.louisgo/scripts/verify.ps1` | Windows 验证入口。                                                    |

## 开发命令

```text
pnpm format:check
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
pnpm pack:check
node ./dist/cli.js verify
```

## 文档

- [项目总览](docs/00-overview.md)
- [产品主路径](docs/01-product.md)
- [文件协议](docs/02-protocol.md)
- [路线图](docs/03-roadmap.md)

## 发布元数据

- npm 包名：`louisgo`
- 当前公开版本：`0.1.0`
- 许可证：MIT
