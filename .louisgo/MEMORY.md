---
schema: louisgo-memory-v1
updated_at: "2026-05-02T08:18:58.632Z"
---

# Memory

## Stable Notes

- 用户希望日常只记 `$init`、`$start`、`$finish`，高级命令由 AI 或调试场景使用。
- `HANDOFF.md` 是正式交接快照，存在时优先于普通记忆。
- `STATE.md` 和 `MEMORY.md` 承担日常滚动记忆，避免没有 finish 的新会话失忆。
- 文档要少而精，旧设计文档不应和新设计并存。

## Topic Files

- `.louisgo/memory/` 可按主题新增长期记忆文件。

## Recent Sessions

- `.louisgo/sessions/` 可按需保存单次会话摘要。
