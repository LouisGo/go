#!/usr/bin/env sh
set -u

sha256_stdin() {
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum | awk '{print $1}'
  else
    shasum -a 256 | awk '{print $1}'
  fi
}

file_sha256() {
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$1" | awk '{print $1}'
  else
    shasum -a 256 "$1" | awk '{print $1}'
  fi
}

create_diff_hash() {
  {
    printf 'git_head\0%s\0' "$GIT_HEAD"
    printf 'status\0'
    git status --porcelain=v1 -z -- . ':!.louisgo/test-results.json' ':!.louisgo/RUNLOG.md' ':!.louisgo/HANDOFF.md' ':!.louisgo/HANDOFF_DRAFT.md' ':!.louisgo/QUICK_SAVE.md' ':!.louisgo/STATE.md' ':!.louisgo/CONFIRM_REQ.md' ':!.louisgo/stats/**' ':!.louisgo/sessions/**'
    printf '\0diff\0'
    if git rev-parse --verify HEAD >/dev/null 2>&1; then
      git diff --binary HEAD -- . ':!.louisgo/test-results.json' ':!.louisgo/RUNLOG.md' ':!.louisgo/HANDOFF.md' ':!.louisgo/HANDOFF_DRAFT.md' ':!.louisgo/QUICK_SAVE.md' ':!.louisgo/STATE.md' ':!.louisgo/CONFIRM_REQ.md' ':!.louisgo/stats/**' ':!.louisgo/sessions/**'
    else
      git diff --binary --cached -- . ':!.louisgo/test-results.json' ':!.louisgo/RUNLOG.md' ':!.louisgo/HANDOFF.md' ':!.louisgo/HANDOFF_DRAFT.md' ':!.louisgo/QUICK_SAVE.md' ':!.louisgo/STATE.md' ':!.louisgo/CONFIRM_REQ.md' ':!.louisgo/stats/**' ':!.louisgo/sessions/**'
      printf '\0'
      git diff --binary -- . ':!.louisgo/test-results.json' ':!.louisgo/RUNLOG.md' ':!.louisgo/HANDOFF.md' ':!.louisgo/HANDOFF_DRAFT.md' ':!.louisgo/QUICK_SAVE.md' ':!.louisgo/STATE.md' ':!.louisgo/CONFIRM_REQ.md' ':!.louisgo/stats/**' ':!.louisgo/sessions/**'
    fi
    printf '\0untracked\0'
    git ls-files --others --exclude-standard -- . ':!.louisgo/test-results.json' ':!.louisgo/RUNLOG.md' ':!.louisgo/HANDOFF.md' ':!.louisgo/HANDOFF_DRAFT.md' ':!.louisgo/QUICK_SAVE.md' ':!.louisgo/STATE.md' ':!.louisgo/CONFIRM_REQ.md' ':!.louisgo/stats/**' ':!.louisgo/sessions/**' | LC_ALL=C sort | while IFS= read -r file; do
      if [ -f "$file" ]; then
        printf 'path\0%s\0hash\0' "$file"
        file_hash="$(file_sha256 "$file")"
        printf '%s' "$file_hash"
        printf '\0'
      fi
    done
  } | sha256_stdin
}

STARTED_AT="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
COMMAND="pnpm format:check && pnpm typecheck && pnpm test && pnpm build && pnpm pack:check"
RESULT_PATH=".louisgo/test-results.json"
STATUS="passed"
EXIT_CODE=0
SUMMARY="Project verification passed"

run_step() {
  step_name="$1"
  shift
  "$@"
  step_exit_code=$?
  if [ "$step_exit_code" -ne 0 ]; then
    EXIT_CODE="$step_exit_code"
    STATUS="failed"
    SUMMARY="$step_name failed"
    return 1
  fi

  return 0
}

run_step "format:check" pnpm format:check &&
  run_step "typecheck" pnpm typecheck &&
  run_step "test" pnpm test &&
  run_step "build" pnpm build &&
  run_step "pack:check" pnpm pack:check

mkdir -p ".louisgo"
GIT_HEAD="$(git rev-parse --verify HEAD 2>/dev/null || printf "NO_HEAD")"
DIFF_HASH="$(create_diff_hash)"
COMPLETED_AT="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"

cat > "$RESULT_PATH" <<JSON
{
  "schema": "louisgo-test-results-v1",
  "command": "$COMMAND",
  "exit_code": $EXIT_CODE,
  "status": "$STATUS",
  "git_head": "$GIT_HEAD",
  "diff_hash": "$DIFF_HASH",
  "started_at": "$STARTED_AT",
  "completed_at": "$COMPLETED_AT",
  "summary": "$SUMMARY"
}
JSON

exit "$EXIT_CODE"
