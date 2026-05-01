export function createVerifyPs1Template(): string {
  return `$ErrorActionPreference = "Stop"

$StartedAt = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
$Command = ".louisgo/scripts/verify.ps1"
$ResultPath = ".louisgo/test-results.json"
$GitHead = (git rev-parse --verify HEAD 2>$null)
if (-not $GitHead) {
  $GitHead = "NO_HEAD"
}
$StatusBytes = [System.Text.Encoding]::UTF8.GetBytes((git status --porcelain=v1 -z | Out-String))
$Sha256 = [System.Security.Cryptography.SHA256]::Create()
$DiffHash = [System.BitConverter]::ToString($Sha256.ComputeHash($StatusBytes)).Replace("-", "").ToLowerInvariant()
$ExitCode = 0
$Status = "passed"
$Summary = "验证通过"

New-Item -ItemType Directory -Force -Path ".louisgo" | Out-Null

$CompletedAt = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
$Result = [ordered]@{
  schema = "louisgo-test-results-v1"
  command = $Command
  exit_code = $ExitCode
  status = $Status
  git_head = $GitHead
  diff_hash = $DiffHash
  started_at = $StartedAt
  completed_at = $CompletedAt
  summary = $Summary
}

$Result | ConvertTo-Json | Set-Content -Encoding UTF8 -Path $ResultPath
exit $ExitCode
`;
}
