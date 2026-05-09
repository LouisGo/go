export function createVerifyPs1Template(): string {
  return `$ErrorActionPreference = "Stop"

function Get-StringSha256([string]$Value) {
  $Bytes = [System.Text.Encoding]::UTF8.GetBytes($Value)
  $Sha256 = [System.Security.Cryptography.SHA256]::Create()
  return [System.BitConverter]::ToString($Sha256.ComputeHash($Bytes)).Replace("-", "").ToLowerInvariant()
}

function Get-FileSha256([string]$Path) {
  return (Get-FileHash -Algorithm SHA256 -LiteralPath $Path).Hash.ToLowerInvariant()
}

$StartedAt = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
$Command = ".louisgo/scripts/verify.ps1"
$GitHead = (git rev-parse --verify HEAD 2>$null)
if ($LASTEXITCODE -ne 0 -or -not $GitHead) {
  $GitHead = "NO_HEAD"
  $HasHead = $false
} else {
  $HasHead = $true
}
$HashInput = [System.Text.StringBuilder]::new()
$IgnoredPathspecs = @(
  ':!.louisgo/test-results.json',
  ':!.louisgo/CONFIRM_REQ.md'
)
[void]$HashInput.Append("git_head\`0$GitHead\`0")
[void]$HashInput.Append("status\`0")
[void]$HashInput.Append((git status --porcelain=v1 -z -- . @IgnoredPathspecs | Out-String))
[void]$HashInput.Append("\`0diff\`0")
if ($HasHead) {
  [void]$HashInput.Append((git diff --binary HEAD -- . @IgnoredPathspecs | Out-String))
} else {
  [void]$HashInput.Append((git diff --binary --cached -- . @IgnoredPathspecs | Out-String))
  [void]$HashInput.Append("\`0")
  [void]$HashInput.Append((git diff --binary -- . @IgnoredPathspecs | Out-String))
}
[void]$HashInput.Append("\`0untracked\`0")
foreach ($File in (git ls-files --others --exclude-standard -- . @IgnoredPathspecs | Sort-Object)) {
  if (Test-Path -LiteralPath $File -PathType Leaf) {
    [void]$HashInput.Append("path\`0$File\`0hash\`0")
    [void]$HashInput.Append((Get-FileSha256 $File))
    [void]$HashInput.Append("\`0")
  }
}
$DiffHash = Get-StringSha256 $HashInput.ToString()
$ExitCode = 0
$Status = "skipped"
$Summary = "No project verification command configured; skipped"

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

$Result | ConvertTo-Json -Compress | Write-Output
exit $ExitCode
`;
}
