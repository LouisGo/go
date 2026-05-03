# 产品主路径

## 用户目标

开发者不应该为了使用 LouisGo 记住一串生命周期命令。标准体验应该是：

```text
一个项目只初始化一次 -> 日常自然提问 -> 阶段完成时收尾
```

LouisGo 的产品定位不是外挂知识库、向量数据库或完整上下文记忆系统，而是一个轻量的 **prompt 智能缓存工程**：

- 把最值得复用的提示词材料沉淀成 Git 可同步的 Markdown 文件。
- 把静态规则、稳定项目事实、长期记忆、当前状态和正式交接分层。
- 让 AI 在新会话、长任务和多 agent 协作时拿到干净、足量、不过载的上下文。
- 保持无后台服务、无数据库、无平台绑定；平台集成只是读取和编排这些文件。

因此 LouisGo 的主路径是：

| 入口 | 用户心智 | 系统行为 |
| --- | --- | --- |
| `louisgo init` | 这个项目以后交给 AI 协作时要有记忆。 | 创建协议目录、默认记忆文件、验证脚本，并安装 Codex 集成。 |
| `$start` | 我需要你重新认真读取项目上下文。 | 读取 handoff、state、memory、任务、能力、验证状态和确认请求。 |
| 自然对话 | 继续开发，不想管理协议。 | AI 按 `AGENTS.md` 自动读取和维护 LouisGo 上下文。 |
| `$finish` | 本阶段结束，给之后的会话一份可靠交接。 | 更新 `HANDOFF.md`，记录验证、diff、阻塞、确认请求和下一步。 |

## 恢复模型

LouisGo 使用两种恢复材料：

- `HANDOFF.md`：正式交接快照。存在时优先读取，适合阶段完成、换人接手、重大上下文切换。
- `STATE.md` / `MEMORY.md`：日常 prompt cache。即使没有 finish，新会话也能恢复当前任务和长期约定。

语义优先级：

```text
CONFIRM_REQ.md -> HANDOFF.md -> STATE.md -> MEMORY.md -> memory/*.md -> sessions/*.md -> Git/源码/验证结果
```

`HANDOFF.md` 不取代 memory；memory 也不能覆盖 handoff。两者冲突时，AI 应先说明冲突，再以源码、Git 和验证结果确认事实。

prompt 组装顺序和语义优先级不同。为了复用平台级 prompt cache，组装时应把最稳定的内容放前面，最易变的内容放后面：

```text
平台入口规则 -> 项目契约 -> 稳定记忆索引 -> 正式交接 -> 当前状态 -> 本轮用户请求
```

这样静态前缀更稳定，后续平台若支持 prefix prompt caching，可自然获得更高缓存命中率。

## 分层缓存架构

| 层 | 文件/载体 | 变化频率 | 作用 | 加载策略 |
| --- | --- | --- | --- | --- |
| L0 平台入口 | `AGENTS.md`、未来 `CLAUDE.md` / `GEMINI.md` / `.cursor/rules` | 很低 | 告诉不同 AI 工具如何进入 LouisGo。 | 平台自动加载；必须短。 |
| L1 项目契约 | `MISSION.md`、`CAPABILITIES.md` | 低 | 项目目标、约束、确认规则、验证入口。 | 新会话必读。 |
| L2 稳定索引 | `MEMORY.md`、`memory/*.md` | 中低 | 长期约定、架构事实、主题索引。 | `MEMORY.md` 必读；topic 文件按需读。 |
| L3 正式恢复 | `HANDOFF.md` | 中 | 阶段交接、换人接手、重大上下文切换。 | 存在时优先读。 |
| L4 活跃状态 | `STATE.md`、`CONFIRM_REQ.md`、`sessions/*.md` | 高 | 当前任务、下一步、未解决确认、短期摘要。 | 只读当前相关内容，避免流水账。 |
| L5 任务技能 | Codex skills / 平台规则 / 子 agent 指令 | 按任务 | 给特定任务或 subagent 干净说明书。 | 只在触发任务时加载。 |

最小成本原则：

- 不做数据库、不做向量检索、不做后台守护进程。
- 不把聊天全文当记忆；只缓存可复用的 prompt 材料。
- 不自动读完整仓库；需要代码结构时，先用 Git、搜索和未来的轻量 repo map。
- 频繁变化的状态不进入基础规则，避免污染所有会话。
- Skill 适合做任务说明书，尤其适合交给 subagent；主 agent 负责选择、裁剪上下文和汇总。

## 命令分层

主命令：

| 命令 | 说明 |
| --- | --- |
| `louisgo init` | 一次性初始化协议和默认 AI 平台集成。 |
| `louisgo context` | 编译分层 prompt cache，生成带来源和预算的上下文包。 |
| `louisgo confirm` | 友好展示待确认选项，支持 `--choice` 把用户选择交给 AI 继续执行。 |
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
- 如果存在，优先运行 `louisgo context` 获取分层上下文包；只有命令不可用时才手动读取 `HANDOFF.md`、`STATE.md`、`MEMORY.md`。
- 存在 `CONFIRM_REQ.md` 时优先运行 `louisgo confirm`，友好展示选项后等待用户选择。
- 涉及实质代码变更后，按需要更新 `STATE.md` 或 session 记忆。
- 用户输入 `$finish` 时，运行 LouisGo 收尾流程，不再要求用户额外执行 handoff promote。
- 需要并行探索、审查或专项实现时，由主 agent 组装一个小而完整的上下文包，再交给 subagent；不要让 subagent 继承整段混杂聊天上下文。

## 多 Agent 编排

LouisGo 的多 agent 方向不是自动调度平台，而是给主 agent 提供可复用的上下文包和任务说明书。

推荐模式：

1. 主 agent 运行 `louisgo context` 读取 L0-L4，确认当前任务和事实来源。
2. 主 agent 根据任务选择一个 skill 或内置任务模板。
3. 主 agent 运行 `louisgo context --capsule --goal "<任务>"` 或等价模板，生成 subagent context capsule：目标、边界、相关文件、可写范围、验证方式、返回格式。
4. subagent 只处理该 capsule，不自行扩大目标。
5. 主 agent 汇总结果，更新 `STATE.md` / `HANDOFF.md` / 验证状态。

这比让每个 subagent 自己读取全部记忆更便宜，也更可控。

## 确认和验证

AI 可以维护状态，但不能把自述当成事实。

需要用户确认的情况：

- npm 发布、许可证、包名、公开协议破坏性变更。
- 大范围重构或两种以上明显可行的架构方向。
- 用户明确要求审阅正式交接内容。

需要验证的情况：

- 代码或协议文件变更后，阶段性汇报前应运行 `louisgo verify` 或说明未运行原因。
- `finish` 必须记录当前验证状态；`stale`、`missing`、`failed` 不能写成通过。

## 外部项目实验路径

AI 开发者可以在任意已初始化 Git 的项目中实验：

```text
node /path/to/louisgo/dist/cli.js init
node /path/to/louisgo/dist/cli.js context --goal "恢复项目上下文"
node /path/to/louisgo/dist/cli.js context --capsule --goal "交给子 agent 的任务"
node /path/to/louisgo/dist/cli.js verify
node /path/to/louisgo/dist/cli.js finish
```

命令必须在目标项目目录运行。实验目标不是验证所有项目测试都通过，而是验证 `.louisgo/` 能被创建、同步、编译上下文、记录验证结果并生成正式交接。
