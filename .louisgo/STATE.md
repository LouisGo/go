---
schema: louisgo-state-v1
mode: assist
current_task: T001
handoff: .louisgo/HANDOFF.md
verification: passed
git_head: 9cf665f7f32dd2d5e7a92205f82ae9274e24346b
diff_hash: 6ef3f9de16198fbcad36e0345360167c885be7aa786d0e40d3f26248cd9a4007
updated_at: "2026-05-02T08:18:58.632Z"
---

# State

## Now

- 当前任务：T001
- 当前方向：将 LouisGo 主路径收敛为 `init -> start -> 自然对话 -> finish`。
- 正式交接：如果存在，优先读取 `.louisgo/HANDOFF.md`。

## Next

- 完成底座重构后运行 `louisgo verify`。

## Recovery Order

1. `.louisgo/HANDOFF.md`
2. `.louisgo/STATE.md`
3. `.louisgo/MEMORY.md`
4. `.louisgo/memory/*.md`
5. `.louisgo/sessions/*.md`
