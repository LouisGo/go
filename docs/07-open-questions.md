# 开放问题

## 使用规则

- 本文件只记录尚未定案的问题。
- 已经确认的决策应移动到对应设计文档或 `docs/08-decision-log.md`。
- 不阻塞 MVP 的问题不要打断当前开发节奏。
- 每个问题必须有状态、优先级和建议处理时机。

## 状态说明

| 状态 | 含义 |
| --- | --- |
| `open` | 尚未讨论或尚无明确倾向。 |
| `watch` | 暂不处理，但需要观察。 |
| `deferred` | 明确延期到 MVP 之后。 |
| `blocked` | 被其他问题阻塞。 |

## 优先级说明

| 优先级 | 含义 |
| --- | --- |
| `P0` | 开发前必须确认。 |
| `P1` | MVP 开发中需要确认。 |
| `P2` | MVP 发布前需要确认。 |
| `P3` | MVP 之后再确认。 |

## 当前开放问题

### Q001 是否需要 npm scope

状态：`watch`

优先级：`P2`

背景：

- MVP 包名已确认直接使用 `louisgo`。
- 未来可能迁移到 `@louisgo/cli`。

当前倾向：

- MVP 先使用 `louisgo`。
- 发布前检查 npm 包名可用性。
- 如果包名不可用，再切换到 scoped package。

处理时机：

- T024 发布准备阶段。

### Q002 Windows 支持边界

状态：`watch`

优先级：`P2`

背景：

- MVP 要保证 Windows 基础可用。
- 当前策略是优先 PowerShell，不针对 cmd.exe 或 Git Bash 做专门优化。
- macOS 是主要体验调优平台。

当前倾向：

- 第一版只保证 `verify.ps1` 模板和 CLI 基础命令可用。
- 不承诺 Windows 终端体验完全一致。

处理时机：

- T015、T016、T022。

### Q003 `diff_hash` 大文件和二进制文件策略

状态：`deferred`

优先级：`P3`

背景：

- MVP 不优化大文件和二进制文件性能。
- 当前目标是保证代码状态变化会导致 hash 变化。

当前倾向：

- MVP 使用保守实现。
- 如果用户仓库存在大文件性能问题，再引入文件大小上限、跳过规则或 Git object hash 优化。

处理时机：

- MVP 后，根据真实使用反馈决定。

### Q004 是否需要完整 JSON Schema 文件

状态：`open`

优先级：`P2`

背景：

- 当前设计使用 TypeScript 类型和 Zod schema 作为实现约束。
- 未来如果要让其他工具复用协议，独立 JSON Schema 文件可能更友好。

当前倾向：

- MVP 不单独维护 JSON Schema 文件。
- 先由 `src/protocol/schemas.ts` 作为权威实现。

处理时机：

- T023 文档阶段或 MVP 后协议外部化阶段。

### Q005 `.louisgo/` 协议版本升级策略

状态：`open`

优先级：`P2`

背景：

- Markdown Front Matter 和 `test-results.json` 都包含 schema 版本。
- 目前还没有定义升级命令或兼容策略。

当前倾向：

- MVP 只支持 v1 schema。
- 发现非 v1 schema 时报告不支持，不自动迁移。

处理时机：

- T010 协议完整性检查。
- T023 README 说明。

### Q006 `BLOCKER.md` 清理策略

状态：`open`

优先级：`P1`

背景：

- 协议要求 `$finish` 不能丢弃未解决阻塞。
- 当前设计要求先写入 `HANDOFF_DRAFT.md`，再允许清理 `QUICK_SAVE.md`。
- `BLOCKER.md` 是否自动清理还没有最终规则。

当前倾向：

- MVP 中 `louisgo finish` 不自动清空 `BLOCKER.md`。
- 只把 blocker 摘要写入 `HANDOFF_DRAFT.md`。
- 后续是否增加 `louisgo blocker clear` 再评估。

处理时机：

- T019、T020。

### Q007 `louisgo pause` 已存在 QUICK_SAVE 时的处理方式

状态：`open`

优先级：`P1`

背景：

- 安全写入默认不覆盖已有文件。
- 但 `$pause` 的自然语义是更新当前快速保存。

当前倾向：

- `louisgo pause` 允许覆盖 `QUICK_SAVE.md`，因为它是短期可覆盖状态。
- 覆盖前不需要用户确认，但要保留稳定字段。
- 这属于安全写入规则的明确例外。

处理时机：

- T017、T018。

### Q008 `louisgo finish` 是否清理 QUICK_SAVE

状态：`open`

优先级：`P1`

背景：

- 协议倾向于 `$finish` 捕获快速保存状态后清理 `QUICK_SAVE.md`。
- 需要明确 CLI 实现是否自动删除。

当前倾向：

- MVP 中 `louisgo finish` 自动删除 `QUICK_SAVE.md`，前提是其内容已进入 `HANDOFF_DRAFT.md`。
- 如果草稿生成失败，不删除。

处理时机：

- T020。

### Q009 是否需要 `louisgo doctor`

状态：`deferred`

优先级：`P3`

背景：

- `status` 已经承担协议完整性检查。
- 未来可能需要更深入的环境诊断，例如 Node 版本、Git 版本、脚本权限、PowerShell 可用性。

当前倾向：

- MVP 不做 `doctor`。
- 如果 `status` 变得过重，再拆出 `doctor`。

处理时机：

- MVP 后。

### Q010 是否需要颜色和交互式输出

状态：`deferred`

优先级：`P3`

背景：

- 终端输出需要清晰，但过早引入交互 UI 会增加复杂度。

当前倾向：

- MVP 使用纯文本输出。
- 不引入 spinner、prompt、彩色复杂 UI。
- 后续根据用户反馈决定是否增加颜色。

处理时机：

- MVP 后。

### Q011 委派能力如何设计

状态：`deferred`

优先级：`P3`

背景：

- 原始设想包含 delegate、worktree、merge、review 等能力。
- MVP 已明确不实现复杂多 Agent 编排。

当前倾向：

- MVP 只在架构上预留，不写实现。
- 委派能力必须等单会话流程稳定后再设计。

处理时机：

- MVP 后，单独写委派设计文档。

### Q012 是否需要 CI 集成模板

状态：`deferred`

优先级：`P3`

背景：

- LouisGo 的验证入口和 CI 有天然关联。
- 但 MVP 目标是本地 AI 编程工作流，不是 CI 产品。

当前倾向：

- MVP 不生成 GitHub Actions 或其他 CI 模板。
- README 可以说明 `louisgo verify` 可被 CI 调用，但不提供官方模板。

处理时机：

- MVP 后。

### Q013 是否需要独立决策和 ADR CLI 命令

状态：`deferred`

优先级：`P3`

背景：

- `CONFIRM_REQ.md` 和 `ADR/draft/` 已进入 MVP 文件协议。
- MVP 暂不实现独立 `louisgo decide` 或 `louisgo adr` 命令。

当前倾向：

- 第一版由 AI 基于协议文件直接生成确认请求和 ADR 草稿。
- 单会话流程稳定后，再评估是否需要专门命令。

处理时机：

- MVP 后。

## 当前不阻塞开发的结论

- 可以开始 T001-T011，不需要先解决所有开放问题。
- T017-T020 前需要确认 Q006、Q007、Q008。
- T024 前需要确认 Q001。
- MVP 后再处理 Q003、Q009、Q010、Q011、Q012、Q013。
