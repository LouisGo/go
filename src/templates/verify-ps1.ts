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
$ResultPath = ".louisgo/test-results.json"
$GitHead = (git rev-parse --verify HEAD 2>$null)
if ($LASTEXITCODE -ne 0 -or -not $GitHead) {
  $GitHead = "NO_HEAD"
  $HasHead = $false
} else {
  $HasHead = $true
}
$HashInput = [System.Text.StringBuilder]::new()
[void]$HashInput.Append("git_head\`0$GitHead\`0")
[void]$HashInput.Append("status\`0")
[void]$HashInput.Append((git status --porcelain=v1 -z -- . ':!.louisgo/test-results.json' | Out-String))
[void]$HashInput.Append("\`0diff\`0")
if ($HasHead) {
  [void]$HashInput.Append((git diff --binary HEAD -- . ':!.louisgo/test-results.json' | Out-String))
} else {
  [void]$HashInput.Append((git diff --binary --cached -- . ':!.louisgo/test-results.json' | Out-String))
  [void]$HashInput.Append("\`0")
  [void]$HashInput.Append((git diff --binary -- . ':!.louisgo/test-results.json' | Out-String))
}
[void]$HashInput.Append("\`0untracked\`0")
foreach ($File in (git ls-files --others --exclude-standard -- . ':!.louisgo/test-results.json' | Sort-Object)) {
  if (Test-Path -LiteralPath $File -PathType Leaf) {
    [void]$HashInput.Append("path\`0$File\`0hash\`0")
    [void]$HashInput.Append((Get-FileSha256 $File))
    [void]$HashInput.Append("\`0")
  }
}
$DiffHash = Get-StringSha256 $HashInput.ToString()
$ExitCode = 0
$Status = "skipped"
$Summary = "未配置项目验证命令，已跳过"

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
