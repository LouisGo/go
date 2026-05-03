# 文件协议

LouisGo 协议目录位于仓库根目录：

```text
.louisgo/
├── MISSION.md
├── CAPABILITIES.md
├── STATE.md
├── MEMORY.md
├── ROADMAP.md
├── HANDOFF.md
├── HANDOFF_DRAFT.md
├── QUICK_SAVE.md
├── BLOCKER.md
├── CONFIRM_REQ.md
├── test-results.json
├── memory/
├── sessions/
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
4. memory/*.md
5. sessions/*.md
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

## 缓存层级

| 层 | 文件 | 写入者 | 是否应频繁变化 | Git 同步 |
| --- | --- | --- | --- | --- |
| L0 平台入口 | `AGENTS.md` 和未来平台适配文件 | `louisgo init` / 用户 | 否 | 是 |
| L1 项目契约 | `MISSION.md`、`CAPABILITIES.md` | 用户为主，AI 辅助 | 否 | 是 |
| L2 稳定索引 | `MEMORY.md`、`memory/*.md` | AI / 用户 | 少量变化 | 是 |
| L3 正式恢复 | `HANDOFF.md` | `$finish` / AI | 阶段性变化 | 是 |
| L4 活跃状态 | `STATE.md`、`CONFIRM_REQ.md`、`sessions/*.md` | AI | 经常变化 | 是，必要时可按项目策略忽略 sessions 详情 |
| L5 任务技能 | Codex skills、未来平台 skill/rule | `louisgo init` / 用户 | 按工作流变化 | 平台相关 |

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
