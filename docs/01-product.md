# 产品主路径

## 用户体验

LouisGo 面向 AI 编程开发者，主路径必须足够简单：

```text
npm install -g louisgo -> louisgo init -> 直接和 AI 开发 -> $start 按需恢复 -> $finish 阶段交接
```

用户不应该记一堆生命周期命令。高级命令存在，但主要由 AI、测试和调试流程调用。

| 入口            | 触发时机                                    | 产品效果                                                          |
| --------------- | ------------------------------------------- | ----------------------------------------------------------------- |
| `npm install -g louisgo` | 首次使用 LouisGo 前                         | 提供稳定全局命令，避免 Codex 新会话恢复时找不到 `louisgo`。       |
| `louisgo init`  | 一个 Git 项目第一次启用 LouisGo             | 创建最小 `.louisgo/` 协议和平台入口，让 AI 以后自动恢复上下文。   |
| 自然对话        | 80%-90% 日常开发                            | AI 在改文件前读取 `louisgo context`，然后按用户最新 prompt 执行。 |
| `$start`        | 语境失真、长任务重启、用户要求重新开始      | 重新编译上下文包，报告恢复来源、验证状态和第一步。                |
| `$finish`       | 阶段完成、换会话、换机器、准备提交          | 生成正式 `HANDOFF.md`，记录验证、diff、阻塞和下一步。             |
| `louisgo stats` | 需要判断 token 消耗、缓存命中和上下文膨胀时 | 汇总本地 context stats 和显式导入的 Codex token usage。           |
| `louisgo skill` | 需要 LouisGo 预设行为 skill 时              | 按需启用或停用预设 skill，并阻止覆盖项目已有同名 skill。          |
| `louisgo clear` | 当前项目不再使用 LouisGo，或需要重置协议时  | 明确确认后删除项目 `.louisgo/`，并移除项目 `AGENTS.md` 管理块。   |

## AI 行为契约

AI 在启用 LouisGo 的仓库中工作时，应遵守这条顺序：

1. 先读 `louisgo context`，确认任务上下文、恢复来源、验证状态和工作区状态；刚初始化且没有真实记忆时，context 会进入冷启动旁路，只保留最小恢复提示。
2. 把用户本轮 prompt 作为真实任务来源，不让旧记忆覆盖新指令。
3. 做代码前检查相关源码、Git diff 和验证结果。
4. 只把跨会话有用的事实写入 `STATE.md`、`MEMORY.md` 或 topic memory。
5. 阶段完成时运行验证或说明未运行原因，再 `$finish`。

如果存在 `CONFIRM_REQ.md`，AI 必须先把选择展示给用户。`louisgo confirm --interactive` 是终端 fallback，不是 Codex 原生 TUI confirm；在 Codex 中应由 AI 把结构化选项呈现给用户。

调试流程时，运行 `louisgo log --tail 30` 或发送 `.louisgo/RUNLOG.md`。日志只记录命令级事件和状态摘要，不记录用户 prompt 正文。

观测 token 时，运行 `louisgo stats` 查看本项目本地事件；运行 `louisgo stats import codex` 才会显式读取 `$CODEX_HOME` / `~/.codex` 的 session JSONL。导入只保存 token usage 数字、来源文件指纹和 section stats，不保存 prompt、聊天正文或源码。

需要移除当前项目 LouisGo 时，先运行 `louisgo clear --dry-run` 查看目标；实际删除运行 `louisgo clear`，并在终端中通过方向键选择列表确认。该命令只清理当前 Git 项目的 `.louisgo/` 和项目 `AGENTS.md` 中 LouisGo 管理的指令块，不清理全局 Codex 配置或全局 skills。

## 恢复模型

语义优先级：

```text
CONFIRM_REQ.md -> HANDOFF.md -> STATE.md -> MEMORY.md -> memory/*.md -> sessions/*.md -> Git/源码/验证结果
```

prompt 组装顺序：

```text
项目契约 -> 稳定记忆 -> 正式交接 -> 活跃状态 -> 用户本轮请求
```

这两个顺序故意不同。组装时把稳定内容放前面，减少 token 噪音；判断事实时以确认请求、正式交接和仓库事实为准。

## 最小有用定义

一个项目真正用上 LouisGo，需要满足：

- `init` 后新会话能自动知道应该读 `.louisgo/`。
- `context` 输出短、带来源、带预算，不塞入无关聊天历史。
- 刚初始化且没有真实记忆时，LouisGo 不把模板文件塞进 prompt。
- AI 能知道当前任务、验证状态、恢复来源和工作区是否有 diff。
- 没有 `HANDOFF.md` 时，`STATE.md` / `MEMORY.md` 仍能恢复基本语境。
- `$finish` 能留下足够接手的信息，而不是只有一句“已完成”。
- `RUNLOG.md` 能让另一个会话判断 LouisGo 是否真的恢复了上下文、运行了验证、生成了交接。
- `stats` 能让用户看到 context 包 token、stable prefix、Codex cached tokens 和预计节省，而不是只凭体感判断 prompt cache 是否有效。
- `clear` 能以明确确认的方式删除当前项目 LouisGo 数据，且不误删业务源码或全局 AI 配置。
- 外部项目可以在不理解 LouisGo 内部命令的情况下完成一次 init/context/verify/finish 实验。

## 多 Agent

LouisGo 不做自动 agent 调度。主 agent 负责读取 `louisgo context`，再按任务生成小的上下文胶囊：

```text
louisgo context --capsule --goal "审查验证流程"
```

subagent 只接收目标、边界、相关文件、验证方式和返回格式，不继承整段混杂聊天历史。
