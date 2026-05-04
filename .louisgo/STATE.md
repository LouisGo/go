---
schema: louisgo-state-v1
mode: assist
current_task: NO_TASK
handoff: .louisgo/HANDOFF.md
verification: passed
git_head: 5479f20d357b57896fc3420a9e94d332560ffd22
diff_hash: b521a960a27888a1f04515bcf5915cd2193e5a34edad697f7885efc91a6896a6
updated_at: "2026-05-04T06:24:24.502Z"
---

# State

## Now

- task: NO_TASK
- verification: passed
- recovery: prefer `.louisgo/HANDOFF.md` when present; otherwise use this file and `.louisgo/MEMORY.md`
- focus: CONTEXT.md protocol support, ADR template simplification, Codex skill description normalization

## Next

- first action: inspect `louisgo context`, then follow the user's latest prompt
- after meaningful work: update this file, run verification when appropriate, then use `$finish` for formal handoff
