# Harness 文件协议

## 目标

本文定义 LouisGo Harness 在仓库内使用的 `.louisgo/` 文件协议。

该协议的目标不是描述某个具体实现，而是明确 AI、脚本和人类用户之间如何通过文件交换可靠状态。

MVP 阶段的重点：

- 单仓库、单主会话。
- Codex CLI 优先。
- 文件即契约。
- 可验证事实优先于 AI 自述。
- 人类确认关键交接状态。

## 协议目录

MVP 约定所有 Harness 文件放在仓库根目录的 `.louisgo/` 下：

```text
.louisgo/
├── MISSION.md
├── ROADMAP.md
├── HANDOFF.md
├── HANDOFF_DRAFT.md
├── QUICK_SAVE.md
├── BLOCKER.md
├── CONFIRM_REQ.md
├── CAPABILITIES.md
├── test-results.json
├── ADR/
│   ├── draft/
│   └── 001-title.md
└── scripts/
    ├── verify.sh
    └── verify.ps1
```

后续版本可能增加委派、worktree、审查和状态索引相关文件，但不进入 MVP 强制范围。

## 文件分类

| 分类 | 文件 | 可信来源 | 是否机器检查 |
| --- | --- | --- | --- |
| 人类约束 | `MISSION.md` | 用户 | 部分检查 |
| 任务状态 | `ROADMAP.md` | 用户和 AI | 部分检查 |
| 正式交接 | `HANDOFF.md` | 用户确认或提升脚本 | 部分检查 |
| 交接草稿 | `HANDOFF_DRAFT.md` | AI | 部分检查 |
| 快速恢复 | `QUICK_SAVE.md` | AI | 部分检查 |
| 阻塞记录 | `BLOCKER.md` | AI | 人类检查为主 |
| 决策请求 | `CONFIRM_REQ.md` | AI | 部分检查 |
| 能力声明 | `CAPABILITIES.md` | 用户或脚手架 | 部分检查 |
| 验证结果 | `test-results.json` | `verify.sh` 或 `verify.ps1` | 必须检查 |
| ADR 草稿 | `ADR/draft/*.md` | AI 或用户 | 部分检查 |
| 正式 ADR | `ADR/*.md` | 用户确认 | 部分检查 |
| 验证入口 | `scripts/verify.sh` | 用户或脚手架 | 通过执行检查 |
| Windows 验证入口 | `scripts/verify.ps1` | 用户或脚手架 | 通过执行检查 |

## Markdown 文件头部字段

除 `BLOCKER.md` 可以保持极简日志外，MVP 中的关键 Markdown 文件应使用 YAML Front Matter 作为固定字段区。

示例：

```markdown
---
schema: louisgo-handoff-v1
mode: assist
task_id: T001
git_head: abc123
verification: stale
updated_at: 2026-05-01T20:00:00+08:00
---

# Handoff
```

规则：

- Front Matter 用于机器读取。
- 正文用于人类审阅。
- AI 可以更新交接草稿、快速保存、确认请求和 ADR 草稿。
- AI 不能绕过用户确认直接把草稿变成正式交接。

## 任务 ID

`ROADMAP.md` 必须使用稳定任务 ID。

任务 ID 格式：

```text
T001
T002
T003
```

MVP 只要求同一仓库内唯一，不要求全局唯一。

`ROADMAP.md` 示例：

```markdown
# Roadmap

- [ ] T001 定义 `.louisgo/` 文件协议
- [ ] T002 设计验证结果 schema
- [x] T003 确定指令命名
```

规则：

- AI 更新任务完成状态时，必须保留任务 ID。
- 任务标题可以调整，但不能复用已存在 ID 表示另一项任务。
- `HANDOFF.md`、`HANDOFF_DRAFT.md`、`QUICK_SAVE.md` 中引用当前任务时，必须使用任务 ID。

## 模式字段

协议中的模式字段使用以下枚举：

```text
auto
assist
manual
```

含义：

- `auto`：AI 可以主动推进低风险实现步骤。
- `assist`：AI 可以执行，但关键方向必须先询问。
- `manual`：AI 默认只读观察，不主动修改状态。

只读命令策略：

- `manual` 模式下，AI 可以执行低风险只读检查，例如 `pwd`、`ls`、`git status`、`rg`、`sed`、`cat`、`git diff`。
- 会修改文件、Git 状态、依赖、网络资源、数据库、外部服务或系统配置的命令，必须先获得用户明确指令。
- 对高成本、长时间或可能泄露敏感信息的只读命令，也应先说明意图。

## 文件规范

### `MISSION.md`

用途：

- 保存项目目标、技术约束、禁止事项、默认模式和确认规则。
- 作为 AI 每次 `$start` 必须读取的项目契约。

写入权限：

- 主要由用户维护。
- AI 可以提出修改建议。
- AI 只有在用户明确要求时才可直接修改。

建议结构：

```markdown
---
schema: louisgo-mission-v1
default_mode: assist
updated_at: 2026-05-01T20:00:00+08:00
---

# Mission

## 项目目标

## 技术约束

## 禁止事项

## 确认规则

## ADR 规则

- 涉及公开 API、数据模型、新技术栈或跨模块边界的架构决策，必须先创建 ADR 草稿。
- ADR 草稿经用户确认后，才能成为正式 ADR。
```

### `ROADMAP.md`

用途：

- 保存当前项目任务清单。
- 给 `$start` 提供默认下一步。

写入权限：

- 用户可以编辑。
- AI 可以在事实明确时新增任务或勾选完成状态。
- AI 不能仅凭自述把任务标为完成；必须有代码事实、验证结果或用户确认。

最小格式：

```markdown
# Roadmap

- [ ] T001 任务标题
- [x] T002 已完成任务标题
```

### `HANDOFF_DRAFT.md`

用途：

- `$finish` 生成的正式交接草稿。
- 供用户审阅后成为下一次会话的权威恢复点。

写入权限：

- AI 生成和更新。
- 用户审阅。

建议结构：

```markdown
---
schema: louisgo-handoff-v1
mode: assist
task_id: T001
git_head: abc123
diff_hash: def456
verification: passed
generated_at: 2026-05-01T20:00:00+08:00
---

# Handoff Draft

## 本次完成

## 验证状态

## 遗留问题

## 下一步
```

### `HANDOFF.md`

用途：

- 保存用户确认后的权威恢复点。
- `$start` 和 `$resume` 可以从这里恢复。

生成方式：

- 不通过用户手动复制生成。
- MVP 允许 AI 基于 `HANDOFF_DRAFT.md` 和固定模板生成。
- 若实现上需要更稳，应提供提升脚本，例如：

```text
louisgo handoff promote
```

提升规则：

- 来源必须是当前存在的 `HANDOFF_DRAFT.md`。
- 必须保留 `mode`、`task_id`、`git_head`、`diff_hash`、`verification` 等字段。
- 如果验证状态为 `stale` 或 `failed`，`HANDOFF.md` 必须显式记录，不得写成已通过。
- 生成后不自动删除 `HANDOFF_DRAFT.md`，除非用户或命令显式要求清理。

### `QUICK_SAVE.md`

用途：

- 保存短时暂停状态。
- 适合午休、切设备、临时离开等低成本恢复场景。

写入权限：

- AI 可由 `$pause` 直接生成。
- 不需要用户审阅。
- `$finish` 捕获其中状态后可以清理。

建议结构：

```markdown
---
schema: louisgo-quick-save-v1
mode: assist
task_id: T001
git_head: abc123
diff_hash: def456
saved_at: 2026-05-01T20:00:00+08:00
---

# Quick Save

## 当前进度

## 下一步

## 遗留问题
```

恢复规则：

- `$start` 发现 `QUICK_SAVE.md` 比 `HANDOFF.md` 更新时，优先读取快速保存状态。
- `$resume` 明确忽略 `QUICK_SAVE.md`，只从正式交接恢复。

### `BLOCKER.md`

用途：

- 记录可复现错误、验证失败、命令失败和阻塞项。
- 不记录泛泛的思考过程。

写入权限：

- AI 可以追加。
- 用户可以编辑或清理。

最小格式：

```markdown
# Blocker

- 2026-05-01T20:00:00+08:00 验证失败：`npm test` 退出码 1，失败用例为 `virtual-list`.
```

规则：

- `$finish` 不能直接丢弃未解决阻塞。
- 未解决阻塞必须写入 `HANDOFF_DRAFT.md` 的遗留问题。
- 后续是否清理 `BLOCKER.md` 由具体命令策略决定，但清理前必须保证状态已被交接草稿捕获。

### `CONFIRM_REQ.md`

用途：

- 保存当前未解决的歧义确认请求。
- 让确认状态从聊天记录中显式落到仓库文件。
- `$finish` 时若仍未解决，必须转存到 `HANDOFF_DRAFT.md` 的遗留问题。

写入权限：

- AI 可以在触发确认规则时创建或更新。
- 用户选择后，AI 应删除该文件并继续执行。
- 同一时间 MVP 只允许一个未解决确认请求。

建议结构：

```markdown
---
schema: louisgo-confirm-req-v1
mode: assist
task_id: T001
status: open
created_at: 2026-05-01T20:00:00+08:00
---

# Confirm Request

## 背景

## 选项

- A. 选项说明
- B. 选项说明
- C. 选项说明
- D. 我重新说明需求

## 建议
```

规则：

- 选项必须清楚表达取舍，不得只列技术名词。
- 如果有推荐选项，应说明推荐原因。
- `status` MVP 固定使用 `open`；用户选择后删除文件，不保留 closed 状态。
- `$start` 发现该文件存在时，必须优先提示用户处理。

### `ADR/draft/*.md` 和 `ADR/*.md`

用途：

- 记录架构决策。
- 保证影响项目长期方向的决策先经用户确认，再进入正式项目记忆。

写入权限：

- AI 可以创建 `ADR/draft/*.md` 草稿。
- 用户可以编辑草稿。
- 正式 `ADR/*.md` 代表用户确认后的决策。

触发条件：

- 公开 API 或协议变更。
- 数据模型或持久化格式变更。
- 新技术栈、关键依赖或架构分层变更。
- 影响多个模块边界的设计决策。

草稿建议结构：

```markdown
---
schema: louisgo-adr-v1
status: draft
adr_id: null
created_at: 2026-05-01T20:00:00+08:00
confirmed_at: null
---

# ADR Draft: 标题

## 背景

## 决策

## 影响

## 备选方案
```

正式 ADR 建议结构：

```markdown
---
schema: louisgo-adr-v1
status: accepted
adr_id: ADR-001
created_at: 2026-05-01T20:00:00+08:00
confirmed_at: 2026-05-01T21:00:00+08:00
---

# ADR-001 标题
```

规则：

- AI 不能把 ADR 草稿直接视为已确认架构决策。
- 正式 ADR 必须保留决策、影响和备选方案。
- MVP 可以不实现独立 ADR CLI 命令，但 `louisgo init` 必须创建 `ADR/draft/` 目录。

### `CAPABILITIES.md`

用途：

- 声明当前项目可用的 Harness 脚本和行为约定。
- 让 AI 知道哪些命令可以调用，调用后应该读取哪些文件。

写入权限：

- 由脚手架生成初版。
- 用户维护。
- AI 只有在用户明确要求时才可直接修改。

建议结构：

```markdown
---
schema: louisgo-capabilities-v1
updated_at: 2026-05-01T20:00:00+08:00
---

# Capabilities

## 验证

- macOS / Linux 命令：`.louisgo/scripts/verify.sh`
- Windows 命令：`.louisgo/scripts/verify.ps1`
- 结果：`.louisgo/test-results.json`

## 行为约定

- 面向用户的状态提示必须包含当前模式。
- 需要用户确认时，写入 `.louisgo/CONFIRM_REQ.md`。
- 涉及架构决策时，写入 `.louisgo/ADR/draft/`。
```

### `test-results.json`

用途：

- 记录验证结果。
- 提供 `$finish` 判断验证是否新鲜的事实来源。

写入权限：

- 只能由 `.louisgo/scripts/verify.sh`、`.louisgo/scripts/verify.ps1` 或等价验证命令写入。
- AI 不应手写该文件作为通过证明。

MVP 最小字段：

```json
{
  "schema": "louisgo-test-results-v1",
  "command": ".louisgo/scripts/verify.sh",
  "exit_code": 0,
  "status": "passed",
  "git_head": "abc123",
  "diff_hash": "def456",
  "started_at": "2026-05-01T20:00:00+08:00",
  "completed_at": "2026-05-01T20:01:00+08:00",
  "summary": "验证通过"
}
```

字段说明：

| 字段 | 类型 | 必需 | 说明 |
| --- | --- | --- | --- |
| `schema` | string | 是 | 固定为 `louisgo-test-results-v1`。 |
| `command` | string | 是 | 实际运行的验证命令。 |
| `exit_code` | number | 是 | 命令退出码。 |
| `status` | string | 是 | `passed`、`failed`、`error` 或 `skipped`。 |
| `git_head` | string | 是 | 验证时的 Git HEAD。 |
| `diff_hash` | string | 是 | 验证时工作区 diff 指纹。 |
| `started_at` | string | 是 | ISO 8601 开始时间。 |
| `completed_at` | string | 是 | ISO 8601 结束时间。 |
| `summary` | string | 是 | 面向人类的简短摘要。 |

新鲜度规则：

- 当前 `git_head` 和 `test-results.json.git_head` 不一致时，验证结果视为过期。
- 当前 `diff_hash` 和 `test-results.json.diff_hash` 不一致时，验证结果视为过期。
- `status` 不是 `passed` 时，不得把任务视为已验证完成。
- 没有 `test-results.json` 时，验证状态为 `missing`。

### `scripts/verify.sh` 和 `scripts/verify.ps1`

用途：

- 作为项目验证的统一入口。
- 不绑定具体技术栈，由项目自己决定内部执行哪些检查。
- macOS / Linux 默认使用 `scripts/verify.sh`。
- Windows 默认使用 `scripts/verify.ps1`。

要求：

- 必须返回有意义的退出码。
- 必须写入 `.louisgo/test-results.json`。
- 应记录当前 Git HEAD 和工作区 diff 指纹。
- 可以在没有测试的项目中执行最小检查，例如文件存在性、脚本可执行性或格式检查。

## 指令行为

### `$start`

流程：

1. 检查 `.louisgo/` 是否存在。
2. 如果必需文件缺失，先报告缺失项。
3. 提醒用户将自动创建缺失文件。
4. 读取 `CAPABILITIES.md` 和 `MISSION.md`。
5. 如果 `CONFIRM_REQ.md` 存在，优先提示存在未解决确认请求。
6. 如果 `QUICK_SAVE.md` 比 `HANDOFF.md` 更新，则从快速保存恢复。
7. 否则从 `HANDOFF.md` 恢复。
8. 如果没有正式交接，则从 `ROADMAP.md` 第一个未完成任务开始。
9. 显示当前模式。

### `$pause`

流程：

1. 读取当前模式和当前任务 ID。
2. 获取当前 Git HEAD 和 diff 指纹。
3. 写入 `QUICK_SAVE.md`。
4. 提示用户已暂存进度。

### `$resume`

流程：

1. 忽略 `QUICK_SAVE.md`。
2. 读取 `HANDOFF.md`。
3. 显示当前模式、当前任务和下一步。

### `$finish`

流程：

1. 获取 Git 变更摘要。
2. 检查 `test-results.json` 是否存在且新鲜。
3. 读取 `BLOCKER.md`。
4. 读取 `CONFIRM_REQ.md`。
5. 生成 `HANDOFF_DRAFT.md`。
6. 如果存在 `CONFIRM_REQ.md`，确认其内容已进入草稿遗留问题后删除。
7. 如果存在 `QUICK_SAVE.md`，确认其状态已被草稿捕获后清理。
8. 提醒用户审阅交接草稿，并通过模板或提升命令生成 `HANDOFF.md`。

## 脚手架要求

MVP 需要提供命令行脚手架，避免用户手动复制模板。

建议命令：

```text
louisgo init
```

预期行为：

- 创建 `.louisgo/` 目录。
- 创建必需 Markdown 文件。
- 创建 `.louisgo/ADR/draft/` 目录。
- 创建 `.louisgo/scripts/verify.sh`。
- 创建 `.louisgo/scripts/verify.ps1`。
- 如果目标文件已存在，不覆盖用户内容。
- 输出后续可执行的 `$start` 提示。

是否提供更多命令由技术选型阶段决定。
