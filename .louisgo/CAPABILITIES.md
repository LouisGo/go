---
schema: louisgo-capabilities-v1
updated_at: "2026-05-02T06:55:00.000Z"
---

# Capabilities

## 验证

- macOS / Linux 命令：`.louisgo/scripts/verify.sh`
- Windows 命令：`.louisgo/scripts/verify.ps1`
- 结果：`.louisgo/test-results.json`
- 当前项目验证内容：`pnpm format:check`、`pnpm typecheck`、`pnpm test`、`pnpm build`
- 打包检查命令：`pnpm pack:check`
- Codex 集成命令：`louisgo codex setup`

## 行为约定

- 面向用户的状态提示必须包含当前模式。
- 需要用户确认时，写入 `.louisgo/CONFIRM_REQ.md`。
- 涉及架构决策时，写入 `.louisgo/ADR/draft/`。
- 发布前必须确认版本号、许可证和 npm 包名可用性。
- 输入 `$start`、`$pause`、`$resume`、`$finish` 时，按 LouisGo Codex skill 映射到对应 CLI。
