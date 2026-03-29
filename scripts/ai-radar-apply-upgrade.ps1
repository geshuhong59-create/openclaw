$ErrorActionPreference = "Stop"

$workspaceRoot = Split-Path -Parent $PSScriptRoot
$stateDir = Join-Path $workspaceRoot "state"
New-Item -ItemType Directory -Force -Path $stateDir | Out-Null

$reportPath = $env:AI_RADAR_REPORT_PATH
if ($reportPath -and [System.IO.Path]::IsPathRooted($reportPath)) {
  $reportPath = [System.IO.Path]::GetRelativePath($workspaceRoot, $reportPath).Replace('\', '/')
}

$payload = @{
  candidateKey = $env:AI_RADAR_CANDIDATE_KEY
  repository = $env:AI_RADAR_CANDIDATE_REPO
  releaseTag = $env:AI_RADAR_CANDIDATE_RELEASE
  branchName = $env:AI_RADAR_BRANCH_NAME
  reportPath = $reportPath
  preparedAt = [DateTime]::UtcNow.ToString("o")
}

$payload | ConvertTo-Json -Depth 5 | Set-Content -Path (Join-Path $stateDir "pending_upgrade.json") -Encoding UTF8

$applyCommand = if ($env:AI_RADAR_APPLY_COMMAND) { $env:AI_RADAR_APPLY_COMMAND } else { "npx tsx scripts/apply-radar-upgrade.ts" }

Write-Host "[apply] executing configured upgrade command"
powershell -NoProfile -Command $applyCommand
if ($LASTEXITCODE -ne 0) {
  throw "Upgrade command failed with exit code $LASTEXITCODE"
}

Remove-Item -Path (Join-Path $stateDir "pending_upgrade.json") -ErrorAction SilentlyContinue
