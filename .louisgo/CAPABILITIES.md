---
schema: louisgo-capabilities-v1
updated_at: "2026-05-03T13:23:31.000Z"
---

# Capabilities

## Daily Commands

- `$init`: 初始化 `.louisgo/` 协议，并安装当前平台需要的 AI 集成。
- `$start`: 运行状态检查和 `louisgo context`，恢复本项目必要语境。
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
- 当前项目验证内容：`pnpm format:check`、`pnpm typecheck`、`pnpm test`、`pnpm build`

## Signals

- 待用户确认：`.louisgo/CONFIRM_REQ.md`
- 友好确认入口：`louisgo confirm` 或 `louisgo confirm --choice <A|B|C|D>`
- 正式交接：`.louisgo/HANDOFF.md`
- 滚动状态：`.louisgo/STATE.md`
- 稳定记忆索引：`.louisgo/MEMORY.md`
