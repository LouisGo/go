# 产品主路径

## 用户体验

LouisGo 面向 AI 编程开发者，主路径必须足够简单：

```text
npx louisgo init -> 直接和 AI 开发 -> $start 按需恢复 -> $finish 阶段交接
```

用户不应该记一堆生命周期命令。高级命令存在，但主要由 AI、测试和调试流程调用。

| 入口 | 触发时机 | 产品效果 |
| --- | --- | --- |
| `louisgo init` | 一个 Git 项目第一次启用 LouisGo | 创建 `.louisgo/` 协议和平台入口，让 AI 以后自动恢复上下文。 |
| 自然对话 | 80%-90% 日常开发 | AI 在改文件前读取 `louisgo context`，然后按用户最新 prompt 执行。 |
| `$start` | 语境失真、长任务重启、用户要求重新开始 | 重新编译上下文包，报告恢复来源、验证状态和第一步。 |
| `$finish` | 阶段完成、换会话、换机器、准备提交 | 生成正式 `HANDOFF.md`，记录验证、diff、阻塞和下一步。 |

## AI 行为契约

AI 在启用 LouisGo 的仓库中工作时，应遵守这条顺序：

1. 先读 `louisgo context`，确认任务上下文、恢复来源、验证状态和工作区状态。
2. 把用户本轮 prompt 作为真实任务来源，不让旧记忆覆盖新指令。
3. 做代码前检查相关源码、Git diff 和验证结果。
4. 只把跨会话有用的事实写入 `STATE.md`、`MEMORY.md` 或 topic memory。
5. 阶段完成时运行验证或说明未运行原因，再 `$finish`。

如果存在 `CONFIRM_REQ.md`，AI 必须先把选择展示给用户。`louisgo confirm --interactive` 是终端 fallback，不是 Codex 原生 TUI confirm；在 Codex 中应由 AI 把结构化选项呈现给用户。

调试流程时，运行 `louisgo log --tail 30` 或发送 `.louisgo/RUNLOG.md`。日志只记录命令级事件和状态摘要，不记录用户 prompt 正文。

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
- AI 能知道当前任务、验证状态、恢复来源和工作区是否有 diff。
- 没有 `HANDOFF.md` 时，`STATE.md` / `MEMORY.md` 仍能恢复基本语境。
- `$finish` 能留下足够接手的信息，而不是只有一句“已完成”。
- `RUNLOG.md` 能让另一个会话判断 LouisGo 是否真的恢复了上下文、运行了验证、生成了交接。
- 外部项目可以在不理解 LouisGo 内部命令的情况下完成一次 init/context/verify/finish 实验。

## 多 Agent

LouisGo 不做自动 agent 调度。主 agent 负责读取 `louisgo context`，再按任务生成小的上下文胶囊：

```text
louisgo context --capsule --goal "审查验证流程"
```

subagent 只接收目标、边界、相关文件、验证方式和返回格式，不继承整段混杂聊天历史。
