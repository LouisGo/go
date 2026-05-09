export function createVerifyShTemplate(): string {
  return `#!/usr/bin/env sh
set -eu

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
    printf 'git_head\\0%s\\0' "$GIT_HEAD"
    printf 'status\\0'
    git status --porcelain=v1 -z -- . ':!.louisgo/test-results.json' ':!.louisgo/CONFIRM_REQ.md'
    printf '\\0diff\\0'
    if git rev-parse --verify HEAD >/dev/null 2>&1; then
      git diff --binary HEAD -- . ':!.louisgo/test-results.json' ':!.louisgo/CONFIRM_REQ.md'
    else
      git diff --binary --cached -- . ':!.louisgo/test-results.json' ':!.louisgo/CONFIRM_REQ.md'
      printf '\\0'
      git diff --binary -- . ':!.louisgo/test-results.json' ':!.louisgo/CONFIRM_REQ.md'
    fi
    printf '\\0untracked\\0'
    git ls-files --others --exclude-standard -- . ':!.louisgo/test-results.json' ':!.louisgo/CONFIRM_REQ.md' | LC_ALL=C sort | while IFS= read -r file; do
      if [ -f "$file" ]; then
        printf 'path\\0%s\\0hash\\0' "$file"
        file_hash="$(file_sha256 "$file")"
        printf '%s' "$file_hash"
        printf '\\0'
      fi
    done
  } | sha256_stdin
}

STARTED_AT="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
COMMAND=".louisgo/scripts/verify.sh"
GIT_HEAD="$(git rev-parse --verify HEAD 2>/dev/null || printf "NO_HEAD")"
DIFF_HASH="$(create_diff_hash)"
STATUS="skipped"
EXIT_CODE=0
SUMMARY="No project verification command configured; skipped"

COMPLETED_AT="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
printf '{"schema":"louisgo-test-results-v1","command":"%s","exit_code":%s,"status":"%s","git_head":"%s","diff_hash":"%s","started_at":"%s","completed_at":"%s","summary":"%s"}\\n' "$COMMAND" "$EXIT_CODE" "$STATUS" "$GIT_HEAD" "$DIFF_HASH" "$STARTED_AT" "$COMPLETED_AT" "$SUMMARY"

exit "$EXIT_CODE"
`;
}
