---
schema: louisgo-state-v1
mode: assist
current_task: T017
handoff: .louisgo/HANDOFF.md
verification: passed
git_head: a6f73d86c64f0348d07fa252104265c894e8f975
diff_hash: b68f144539351d6acdc18f5d94be49178ec3538c7f02c9c5aa59d776e06fcdf1
updated_at: "2026-05-08T03:12:00.000Z"
---

# State

## Now

- task: T017 项目级 LouisGo clear 清理命令
- verification: passed and fresh
- recovery: prefer `.louisgo/HANDOFF.md` when present; otherwise use this file and `.louisgo/MEMORY.md`
- focus: `louisgo clear` now uses an `@inquirer/prompts` select list like create-vite, deletes project `.louisgo/`, removes the project `AGENTS.md` managed block, and leaves global Codex config untouched

## Next

- first action: commit the select-list clear changes; do not push until the user explicitly asks
- after meaningful work: use `$finish` for formal handoff

## Evidence

- verification | `node ./dist/cli.js verify` | passed and fresh at 2026-05-06T16:17:01Z
- stats smoke | `node ./dist/cli.js stats --json` | command returns valid empty summary before events are collected
- focused tests | `pnpm typecheck` and `pnpm test -- tests/clear-service.test.ts tests/clear-command.test.ts tests/readme.test.ts tests/templates.test.ts tests/init-service.test.ts` | passed during T017 implementation
- verification | `node ./dist/cli.js verify` | passed and fresh at 2026-05-08T01:51:01Z after adding `louisgo clear`
- focused tests | `pnpm typecheck` and `pnpm test -- tests/clear-command.test.ts tests/clear-service.test.ts tests/readme.test.ts tests/templates.test.ts tests/init-service.test.ts` | passed after changing `clear` to interactive A/B confirmation
- verification | `node ./dist/cli.js verify` | passed and fresh at 2026-05-08T02:48:12Z after changing `clear` to interactive confirmation
- smoke | temp Git repo with `init --no-codex`, `printf 'A\n' | clear`, and `printf 'B\n' | clear` | cancel preserves `.louisgo/`; confirm removes it
- global install | `npm install -g .` then `louisgo clear --help` | global command exposes `clear` with only `--dry-run`, no destructive confirm flag
- dependency | `pnpm add @inquirer/prompts` | provides create-vite style direction-key select prompts
- verification | `node ./dist/cli.js verify` | passed and fresh at 2026-05-08T03:10:28Z after replacing A/B input with select prompt
- smoke | temp Git repo with `printf '\n' | clear` and `printf '\033[B\n' | clear` | default selection cancels; down-arrow selection confirms and removes `.louisgo/`
- global install | `npm install -g .` | global `louisgo clear` now uses the select-list prompt
