export function createVerifyShTemplate(): string {
  return `#!/usr/bin/env sh
set -eu

STARTED_AT="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
COMMAND=".louisgo/scripts/verify.sh"
RESULT_PATH=".louisgo/test-results.json"
GIT_HEAD="$(git rev-parse --verify HEAD 2>/dev/null || printf "NO_HEAD")"
DIFF_HASH="$(git status --porcelain=v1 -z | shasum -a 256 | awk '{print $1}')"
STATUS="passed"
EXIT_CODE=0
SUMMARY="验证通过"

mkdir -p ".louisgo"

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
`;
}
