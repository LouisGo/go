$ErrorActionPreference = "Continue"

function Get-StringSha256([string]$Value) {
  $Bytes = [System.Text.Encoding]::UTF8.GetBytes($Value)
  $Sha256 = [System.Security.Cryptography.SHA256]::Create()
  return [System.BitConverter]::ToString($Sha256.ComputeHash($Bytes)).Replace("-", "").ToLowerInvariant()
}

function Get-FileSha256([string]$Path) {
  return (Get-FileHash -Algorithm SHA256 -LiteralPath $Path).Hash.ToLowerInvariant()
}

function Invoke-Step([string]$Name, [string[]]$Arguments) {
  & pnpm @Arguments
  if ($LASTEXITCODE -ne 0) {
    return @{
      ExitCode = $LASTEXITCODE
      Summary = "$Name 未通过"
    }
  }

  return @{
    ExitCode = 0
    Summary = "$Name 通过"
  }
}

$StartedAt = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
$Command = "pnpm format:check && pnpm typecheck && pnpm test && pnpm build && pnpm pack:check"
$ResultPath = ".louisgo/test-results.json"
$Status = "passed"
$ExitCode = 0
$Summary = "项目验证通过"

foreach ($Step in @(
  @{ Name = "format:check"; Arguments = @("format:check") },
  @{ Name = "typecheck"; Arguments = @("typecheck") },
  @{ Name = "test"; Arguments = @("test") },
  @{ Name = "build"; Arguments = @("build") },
  @{ Name = "pack:check"; Arguments = @("pack:check") }
)) {
  $Result = Invoke-Step $Step.Name $Step.Arguments
  if ($Result.ExitCode -ne 0) {
    $ExitCode = $Result.ExitCode
    $Status = "failed"
    $Summary = $Result.Summary
    break
  }
}

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
  ':!.louisgo/RUNLOG.md',
  ':!.louisgo/HANDOFF.md',
  ':!.louisgo/HANDOFF_DRAFT.md',
  ':!.louisgo/QUICK_SAVE.md',
  ':!.louisgo/STATE.md',
  ':!.louisgo/CONFIRM_REQ.md',
  ':!.louisgo/sessions/**'
)
[void]$HashInput.Append("git_head`0$GitHead`0")
[void]$HashInput.Append("status`0")
[void]$HashInput.Append((git status --porcelain=v1 -z -- . @IgnoredPathspecs | Out-String))
[void]$HashInput.Append("`0diff`0")
if ($HasHead) {
  [void]$HashInput.Append((git diff --binary HEAD -- . @IgnoredPathspecs | Out-String))
} else {
  [void]$HashInput.Append((git diff --binary --cached -- . @IgnoredPathspecs | Out-String))
  [void]$HashInput.Append("`0")
  [void]$HashInput.Append((git diff --binary -- . @IgnoredPathspecs | Out-String))
}
[void]$HashInput.Append("`0untracked`0")
foreach ($File in (git ls-files --others --exclude-standard -- . @IgnoredPathspecs | Sort-Object)) {
  if (Test-Path -LiteralPath $File -PathType Leaf) {
    [void]$HashInput.Append("path`0$File`0hash`0")
    [void]$HashInput.Append((Get-FileSha256 $File))
    [void]$HashInput.Append("`0")
  }
}

$DiffHash = Get-StringSha256 $HashInput.ToString()
$CompletedAt = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
New-Item -ItemType Directory -Force -Path ".louisgo" | Out-Null

$Output = [ordered]@{
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

$Output | ConvertTo-Json | Set-Content -Encoding UTF8 -Path $ResultPath
exit $ExitCode
