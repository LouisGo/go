---
schema: louisgo-memory-v1
updated_at: "2026-05-03T13:23:31.000Z"
---

# Memory

## Stable Notes

- 用户希望 80%-90% 日常工作只用 `$init`、`$start`、`$finish`；高级命令面向 AI、调试和自动化。
- LouisGo 定位为 Git 可同步 prompt cache，不做默认外部记忆系统。
- `HANDOFF.md` 是正式、大粒度交接；存在时优先读取，但没有 handoff 时不能导致新会话失忆。
- `louisgo context` 是可执行上下文编译器：按稳定层级组装、报告来源、控制预算、保留用户 prompt 优先级。
- 子 agent 使用 `louisgo context --capsule --goal "<任务>"` 获取干净上下文，避免继承完整聊天历史。
- `louisgo@0.1.0` 已发布到 npmjs，许可证 MIT；registry 安装 smoke test 已通过。

## Topic Files

- `.louisgo/memory/` 只放跨会话复用的长期主题记忆。

## Recent Sessions

- `.louisgo/sessions/` 只在需要审计、交接或总结关键会话时使用。
