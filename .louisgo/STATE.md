---
schema: louisgo-state-v1
mode: assist
phase: idle
current_task: NO_TASK
handoff: .louisgo/HANDOFF.md
verification: passed
git_head: f984fd87696a6e236edf93b04e0247ca97409418
diff_hash: e0d0978e0b5e6866eb240476168aaf8bd5db7a3227787eba683811e9558bdc80
updated_at: "2026-05-08T08:50:46.873Z"
---

# State

## Now

- task: NO_TASK
- verification: passed
- recovery: prefer `.louisgo/HANDOFF.md` when present; otherwise use this file and `.louisgo/MEMORY.md`
- focus: fill this with the current concrete development goal

## Next

- first action: inspect `louisgo context`, then follow the user's latest prompt
- after meaningful work: update this file, run verification when appropriate, then use `$finish` for formal handoff

## Evidence

- claim: | basis: | implication:
