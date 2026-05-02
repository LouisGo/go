# 产品主路径

## 用户目标

开发者不应该为了使用 LouisGo 记住一串生命周期命令。标准体验应该是：

```text
一个项目只初始化一次 -> 日常自然提问 -> 阶段完成时收尾
```

因此 LouisGo 的主路径是：

| 入口 | 用户心智 | 系统行为 |
| --- | --- | --- |
| `louisgo init` | 这个项目以后交给 AI 协作时要有记忆。 | 创建协议目录、默认记忆文件、验证脚本，并安装 Codex 集成。 |
| `$start` | 我需要你重新认真读取项目上下文。 | 读取 handoff、state、memory、任务、能力、验证状态和确认请求。 |
| 自然对话 | 继续开发，不想管理协议。 | AI 按 `AGENTS.md` 自动读取和维护 LouisGo 上下文。 |
| `$finish` | 本阶段结束，给之后的会话一份可靠交接。 | 更新 `HANDOFF.md`，记录验证、diff、阻塞、确认请求和下一步。 |

## 恢复模型

LouisGo 使用两种记忆：

- `HANDOFF.md`：正式交接快照。存在时优先读取，适合阶段完成、换人接手、重大上下文切换。
- `STATE.md` / `MEMORY.md`：日常滚动记忆。即使没有 finish，新会话也能恢复当前任务和长期约定。

读取优先级：

```text
HANDOFF.md -> STATE.md -> MEMORY.md -> memory/*.md -> sessions/*.md -> Git/源码/验证结果
```

`HANDOFF.md` 不取代 memory；memory 也不能覆盖 handoff。两者冲突时，AI 应先说明冲突，再以源码、Git 和验证结果确认事实。

## 命令分层

主命令：

| 命令 | 说明 |
| --- | --- |
| `louisgo init` | 一次性初始化协议和默认 AI 平台集成。 |
| `louisgo status` | 查看协议完整性和当前恢复来源。 |
| `louisgo verify` | 运行项目验证入口并检查结果新鲜度。 |
| `louisgo finish` | 更新正式交接和当前状态。 |

高级兼容命令：

| 命令 | 说明 |
| --- | --- |
| `louisgo pause` | 保留给短期中断和旧工作流。 |
| `louisgo handoff promote` | 保留给旧的草稿提升流程。 |
| `louisgo codex setup` | 重新安装 Codex 集成；`init` 默认已执行。 |

## Codex 行为

`louisgo init` 写入的 `AGENTS.md` 必须让 AI 在已启用 LouisGo 的仓库里自动执行以下行为：

- 普通新会话或新任务开始时，先检查 `.louisgo/` 是否存在。
- 如果存在，先读 `HANDOFF.md`、`STATE.md`、`MEMORY.md` 中存在的文件。
- 存在 `CONFIRM_REQ.md` 时优先处理确认请求。
- 涉及实质代码变更后，按需要更新 `STATE.md` 或 session 记忆。
- 用户输入 `$finish` 时，运行 LouisGo 收尾流程，不再要求用户额外执行 handoff promote。

## 确认和验证

AI 可以维护状态，但不能把自述当成事实。

需要用户确认的情况：

- npm 发布、许可证、包名、公开协议破坏性变更。
- 大范围重构或两种以上明显可行的架构方向。
- 用户明确要求审阅正式交接内容。

需要验证的情况：

- 代码或协议文件变更后，阶段性汇报前应运行 `louisgo verify` 或说明未运行原因。
- `finish` 必须记录当前验证状态；`stale`、`missing`、`failed` 不能写成通过。
