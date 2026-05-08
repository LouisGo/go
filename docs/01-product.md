# Product Path

## User Experience

LouisGo targets AI coding developers, so the main path must stay simple:

```text
npm install -g louisgo -> louisgo init -> code with AI normally -> $start when recovery is needed -> $finish for phase handoff
```

Users should not need to memorize a lifecycle command set. Advanced commands exist, but they are mainly for AI, tests, and diagnostics.

| Entry | Trigger | Product effect |
| --- | --- | --- |
| `npm install -g louisgo` | Before first use | Provides a stable global command so new Codex sessions can find `louisgo`. |
| `louisgo init` | First time enabling LouisGo in a Git project | Creates the minimal `.louisgo/` protocol and platform entry so AI can recover context later. |
| Natural conversation | 80-90% of daily work | AI reads `louisgo context` before editing files, then follows the latest user prompt. |
| `$start` | Context drift, long-task restart, or explicit user reset | Rebuilds the context package and reports recovery source, verification state, and first action. |
| `$finish` | Phase completion, session handoff, machine switch, or commit prep | Generates formal `HANDOFF.md` with verification, diff, blockers, and next steps. |
| `louisgo stats` | Token, cache, or context-growth inspection | Summarizes local context stats and explicitly imported Codex token usage. |
| `louisgo skill` | Optional LouisGo preset behavior is needed | Enables or disables preset skills on demand and blocks same-name project skill overwrites. |
| `louisgo clear` | Removing or resetting LouisGo for the current project | Deletes project `.louisgo/` after explicit confirmation and removes the managed project-agent block. |

## AI Behavior Contract

When AI works in a LouisGo-enabled repository, it should follow this order:

1. Read `louisgo context` first to understand task context, recovery source, verification state, and workspace state. In a fresh project with no real memory, context uses a cold-start bypass and keeps only minimal recovery guidance.
2. Treat the current user prompt as the real task source; never let old memory override new instructions.
3. Before changing code, inspect relevant source, Git diff, and verification facts.
4. Write only cross-session useful facts to `STATE.md`, `MEMORY.md`, or topic memory.
5. At phase completion, run verification or explain why it was not run, then use `$finish`.

If `CONFIRM_REQ.md` exists, AI must present the choices to the user first. `louisgo confirm --interactive` is a terminal fallback, not a native Codex TUI. Inside Codex, AI should present the structured options itself.

For diagnostics, run `louisgo log --tail 30` or send `.louisgo/RUNLOG.md`. Logs record command-level events and state summaries, not user prompt text.

For token observation, run `louisgo stats` for project-local events. Run `louisgo stats import codex` only when explicitly importing `$CODEX_HOME` or `~/.codex` session JSONL. Import stores token usage numbers, source file fingerprints, and section stats only; it does not store prompts, chat text, responses, or source code.

To remove LouisGo from the current project, run `louisgo clear --dry-run` first. Then run `louisgo clear` and confirm through the direction-key selection prompt. The command removes only this Git project's `.louisgo/` and the LouisGo-managed block inside project agent instruction files. It does not touch global Codex config or global skills.

## Recovery Model

Semantic priority:

```text
CONFIRM_REQ.md -> HANDOFF.md -> STATE.md -> MEMORY.md -> memory/*.md -> sessions/*.md -> Git/source/verification results
```

Prompt assembly order:

```text
Project contract -> stable memory -> formal handoff -> active state -> current user request
```

These orders intentionally differ. Stable content goes earlier to reduce token noise during assembly. For factual judgment, confirmation requests, formal handoffs, and repository facts take priority.

## Minimum Useful Definition

A project is actually using LouisGo when:

- After `init`, a new AI session automatically knows to read `.louisgo/`.
- `context` output is short, sourced, budgeted, and free of unrelated chat history.
- Fresh projects with no real memory do not inject template files into the prompt.
- AI can see current task, verification state, recovery source, and whether the workspace has a diff.
- Without `HANDOFF.md`, `STATE.md` and `MEMORY.md` can still recover basic context.
- `$finish` leaves enough handoff information, not just "done".
- `RUNLOG.md` lets another session judge whether LouisGo actually restored context, ran verification, and generated a handoff.
- `stats` shows context package tokens, stable prefix, Codex cached tokens, and simulated savings instead of relying on subjective feel.
- `clear` removes project LouisGo data with explicit confirmation and does not delete source code or global AI config.
- External projects can complete an init/context/verify/finish experiment without understanding LouisGo internals.

## Multi-Agent

LouisGo does not perform automatic agent scheduling. The main agent reads `louisgo context`, then creates small context capsules for subtasks:

```text
louisgo context --capsule --goal "review verification flow"
```

Subagents should receive only the goal, boundaries, relevant files, verification method, and expected return format. They should not inherit a mixed full chat history.
