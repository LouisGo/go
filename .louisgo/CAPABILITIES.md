---
schema: louisgo-capabilities-v1
updated_at: "2026-05-04T06:21:00.000Z"
---

# Capabilities

## Daily Commands

- `$init`: 初始化 `.louisgo/` 协议，并安装当前平台需要的 AI 集成。
- 自然对话：AI 在改文件前运行 `louisgo context`，普通新会话不要求反复 `$start`。
- `$start`: 手动深度恢复，运行 `louisgo context` 并报告恢复来源、验证状态和第一步。
- `$finish`: 运行收尾，生成正式 `.louisgo/HANDOFF.md`。

## Context

- 主恢复命令：`louisgo context --goal "<本轮目标>" --budget <tokens>`
- 子 agent 胶囊：`louisgo context --capsule --goal "<子任务>" --budget <tokens>`
- 组装顺序：MISSION/CAPABILITIES -> MEMORY -> HANDOFF -> CONFIRM_REQ/STATE。
- 输出必须包含来源、预算报告和用户 prompt 优先契约。

## Verify

- macOS / Linux 命令：`.louisgo/scripts/verify.sh`
- Windows 命令：`.louisgo/scripts/verify.ps1`
- 结果：`.louisgo/test-results.json`
- 当前项目验证内容：`pnpm format:check`、`pnpm typecheck`、`pnpm test`、`pnpm build`、`pnpm pack:check`
- `louisgo status` 会报告当前 Git 工作区是否还有待处理变更，避免验证通过但成果边界不清。

## Signals

- 待用户确认：`.louisgo/CONFIRM_REQ.md`
- 友好确认入口：`louisgo confirm`、`louisgo confirm --choice <A|B|C|D>` 或 `louisgo confirm --interactive`
- 诊断日志：`.louisgo/RUNLOG.md` 或 `louisgo log --tail 30`
- 正式交接：`.louisgo/HANDOFF.md`
- 滚动状态：`.louisgo/STATE.md`
- 稳定记忆索引：`.louisgo/MEMORY.md`
