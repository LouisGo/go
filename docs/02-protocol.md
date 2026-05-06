# 文件协议

LouisGo 协议目录位于仓库根目录：

```text
.louisgo/
├── MISSION.md
├── CAPABILITIES.md
├── CONTEXT.md
├── STATE.md
├── MEMORY.md
├── ROADMAP.md
├── HANDOFF.md
├── HANDOFF_DRAFT.md
├── QUICK_SAVE.md
├── BLOCKER.md
├── CONFIRM_REQ.md
├── RUNLOG.md
├── stats/
│   ├── events.jsonl
│   └── imports.json
├── test-results.json
├── memory/
├── sessions/
├── skills/
│   ├── caveman.md
│   ├── diagnose.md
│   ├── grill.md
│   └── zoom-out.md
├── ADR/
│   └── draft/
└── scripts/
    ├── verify.sh
    └── verify.ps1
```

`HANDOFF_DRAFT.md` 和 `QUICK_SAVE.md` 是兼容旧流程的临时文件，不是主恢复来源。

## 协议定位

`.louisgo/` 是一个 Git 可同步的 prompt cache，不是完整知识库。

协议文件必须满足：

- 人类可读：Markdown 正文可直接审阅。
- 机器可读：Front Matter 提供稳定 schema。
- 分层可裁剪：基础规则短而稳定，活跃状态短而新，详细内容按需读取。
- 可同步：默认可以通过 Git 在机器、worktree、agent 之间同步。
- 可验证：代码事实和验证结果优先于记忆叙述。

## 格式

Markdown 文件默认使用 YAML Front Matter：

```markdown
---
schema: louisgo-state-v1
mode: assist
current_task: T001
handoff: .louisgo/HANDOFF.md
verification: stale
git_head: abc123
diff_hash: def456
updated_at: "2026-05-02T12:00:00.000Z"
---

# State
```

规则：

- Front Matter 给 CLI 和 AI 做稳定读取。
- 正文给人类和 AI 读写。
- JSON 只用于 `test-results.json` 这类机器验证结果。
- AI 可以更新 `STATE.md`、`MEMORY.md`、`sessions/*.md`、`HANDOFF.md`、`CONFIRM_REQ.md` 和 ADR 草稿，但不能伪造验证通过。

## 核心文件

### `MISSION.md`

项目目标、技术约束、禁止事项、确认规则和默认模式。AI 每次恢复上下文时必须尊重它。

### `CAPABILITIES.md`

当前仓库的验证入口和行为约定。默认记录 `verify.sh`、`verify.ps1` 和平台集成状态。

### `STATE.md`

当前工作状态。它是 L4 活跃缓存，应该短、小、新，适合每次新会话自动读取。

建议结构：

```markdown
# State

## Now

当前任务、工作区状态和第一优先级。

## Next

下一步第一件具体动作。

## Recovery Order

1. HANDOFF.md
2. STATE.md
3. MEMORY.md
4. memory/\*.md
5. sessions/\*.md
```

### `MEMORY.md`

滚动记忆索引。它是 L2 稳定索引，不应该变成长篇流水账，而是记录长期有效的约定、主题文件和最近会话指针。

建议结构：

```markdown
# Memory

## Stable Notes

- 长期有效的产品和工程约定。

## Topic Files

- memory/architecture.md
- memory/testing.md

## Recent Sessions

- sessions/2026-05-02-xxxx.md
```

### `CONTEXT.md`

项目领域术语表（可选）。AI 每次恢复上下文时，如果此文件存在，会使用其中定义的术语，避免同义词歧义。

此文件没有 Front Matter，由 AI 或用户按需创建，`louisgo init` 不自动生成。

建议结构：

```markdown
# {Project Name} Domain Glossary

## Language

- **Term**: definition _Avoid_: alias1, alias2

## Relationships

- term A relates to term B because...

## Flagged Ambiguities

- term X was used to mean both Y and Z — resolved: ...
```

### `skills/`

行为引导 skill 目录。`louisgo init` 预设 2 个 skill，用户可以自由增删改。Skill 文件作为按需参考，不会自动注入上下文包——AI 根据 CAPABILITIES.md 中的场景描述按需读取。

预设 skill：

- **grill.md** — 逐一追问用户计划的每个分支，直到达成共同理解。适用于用户说 "grill me" 或需要验证设计时。
- **caveman.md** — 极简通信模式，去掉填充词、冠词和客套话，保持技术准确性。适用于用户说 "caveman mode" 或想省 token 时。

规则：

- Skill 内容全部英文（AI 读取）。
- `louisgo init` 生成预设 skill，重复 init 不覆盖已有文件。
- Skill 不参与上下文自动注入，AI 显式调用时才读取对应文件。

### `HANDOFF.md`

正式交接快照。它是 L3 正式恢复缓存，存在时优先于普通记忆。

必须包含：

- 当前任务和模式。
- Git HEAD 和 diff hash。
- 验证状态。
- 当前工作区摘要。
- 阻塞、确认请求和 ADR 草稿。
- 下一步恢复建议。

### `CONFIRM_REQ.md`

未解决确认请求。存在时 AI 必须优先提示并等待用户选择，不能把它埋在普通 memory 里。

### `RUNLOG.md`

本地诊断日志。LouisGo 命令会自动追加短事件，记录命令名、结果、恢复来源、验证状态、确认请求、ADR 草稿数量和工作区摘要。

规则：

- 不记录用户 prompt 正文、聊天全文、源码内容或 secrets。
- 默认由 `.louisgo/.gitignore` 忽略，不制造 Git 噪音。
- 需要诊断时运行 `louisgo log --tail 30`，或直接发送 `.louisgo/RUNLOG.md`。
- 日志只保留最近事件，避免长期 token 膨胀。

### `stats/`

本地 token 和 context 观测目录，默认由 `.louisgo/.gitignore` 忽略。

文件：

- `events.jsonl`：LouisGo context 估算事件和显式导入的 Codex usage 事件。
- `imports.json`：Codex JSONL 文件指纹，避免重复导入。

规则：

- `louisgo context` 只写 section 名称、来源路径、token 数和 cache-friendly 指标。
- `louisgo stats import codex` 只提取 Codex JSONL 中的 `input_tokens`、`cached_input_tokens`、`output_tokens`、`reasoning_output_tokens`、`total_tokens` 等数字。
- 不保存用户 prompt、聊天全文、模型回复正文、源码内容或 secrets。
- 统计口径分为 `actual`、`estimated`、`simulated`：真实 Codex usage、本地 tokenizer 估算、以及基于 baseline 的预计节省。

### `test-results.json`

验证事实来源。最少包含：

- schema
- command
- status
- exit_code
- started_at / finished_at
- git_head
- diff_hash
- summary

`status` 取值：

```text
passed | failed | error | skipped
```

CLI 额外根据 Git HEAD 和 diff hash 判断 `missing`、`stale`。

diff hash 会忽略 LouisGo 生成型恢复和诊断文件：`test-results.json`、`RUNLOG.md`、`HANDOFF.md`、`HANDOFF_DRAFT.md`、`QUICK_SAVE.md`、`STATE.md`、`CONFIRM_REQ.md`、`stats/` 和 `sessions/`。这样 `$finish`、日志追加或本地观测事件不会让刚完成的验证立刻过期；源码、验证脚本和未排除的协议文件变化仍会触发 stale。

## 缓存层级

| 层           | 文件                                                    | 写入者                | 是否应频繁变化 | Git 同步                                 |
| ------------ | ------------------------------------------------------- | --------------------- | -------------- | ---------------------------------------- |
| L0 平台入口  | `AGENTS.md` 和未来平台适配文件                          | `louisgo init` / 用户 | 否             | 是                                       |
| L1 项目契约  | `MISSION.md`、`CAPABILITIES.md`                         | 用户为主，AI 辅助     | 否             | 是                                       |
| L2 稳定索引  | `MEMORY.md`、`CONTEXT.md`、`skills/*.md`、`memory/*.md` | AI / 用户             | 少量变化       | 是                                       |
| L3 正式恢复  | `HANDOFF.md`                                            | `$finish` / AI        | 阶段性变化     | 是                                       |
| L4 活跃状态  | `STATE.md`、`CONFIRM_REQ.md`、`sessions/*.md`           | AI                    | 经常变化       | 是，必要时可按项目策略忽略 sessions 详情 |
| L4b 本地观测 | `stats/*.jsonl`、`stats/imports.json`                   | CLI                   | 经常变化       | 默认否                                   |
| L5 任务技能  | Codex skills、未来平台 skill/rule                       | `louisgo init` / 用户 | 按工作流变化   | 平台相关                                 |

平台 prompt 组装应尽量保持 L0-L2 为稳定前缀，把 L3-L4 放在后面。语义恢复仍按确认请求、正式交接、活跃状态的顺序判断。

## 状态优先级

语义恢复时按以下顺序判断：

1. `CONFIRM_REQ.md`：如果存在，先处理确认。
2. `HANDOFF.md`：正式交接优先。
3. `STATE.md`：当前状态。
4. `MEMORY.md`：滚动记忆索引。
5. `memory/*.md` 和 `sessions/*.md`：按任务需要读取。
6. Git、源码、验证结果：用于确认事实。

如果文件内容与仓库事实冲突，以源码、Git 和验证结果为准，并更新对应协议文件。

## Subagent Context Capsule

主 agent 委派 subagent 时，不应直接传完整记忆库。LouisGo 推荐用 `louisgo context --capsule --goal "<任务>"` 生成短 context capsule：

```markdown
---
schema: louisgo-context-capsule-v1
task_id: T001
mode: assist
source_handoff: .louisgo/HANDOFF.md
created_at: "2026-05-03T12:00:00.000Z"
---

# Context Capsule

## Goal

## Scope

## Relevant Files

## Constraints

## Verification

## Expected Output
```

该 capsule 可以是临时 prompt，也可以在需要审计时写入 `.louisgo/sessions/`。它的目标是给 subagent 干净上下文，而不是创建长期记忆。
