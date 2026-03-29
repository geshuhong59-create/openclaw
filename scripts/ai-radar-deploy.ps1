$ErrorActionPreference = "Stop"

$workspaceRoot = Split-Path -Parent $PSScriptRoot
$stateDir = Join-Path $workspaceRoot "state"
$deployTarget = if ($env:AI_RADAR_DEPLOY_TARGET) { $env:AI_RADAR_DEPLOY_TARGET } else { "staging" }
New-Item -ItemType Directory -Force -Path $stateDir | Out-Null

$receipt = @{
  candidateKey = $env:AI_RADAR_CANDIDATE_KEY
  repository = $env:AI_RADAR_CANDIDATE_REPO
  releaseTag = $env:AI_RADAR_CANDIDATE_RELEASE
  branchName = $env:AI_RADAR_BRANCH_NAME
  deployTarget = $deployTarget
  startedAt = [DateTime]::UtcNow.ToString("o")
}

$receipt | ConvertTo-Json -Depth 5 | Set-Content -Path (Join-Path $stateDir "pending_deploy.json") -Encoding UTF8

$deployCommand = if ($env:AI_RADAR_DEPLOY_COMMAND) { $env:AI_RADAR_DEPLOY_COMMAND } else { "npx tsx scripts/deploy-radar-upgrade.ts" }

Write-Host "[deploy] executing configured deployment command"
powershell -NoProfile -Command $deployCommand
if ($LASTEXITCODE -ne 0) {
  throw "Deploy command failed with exit code $LASTEXITCODE"
}

if ($env:AI_RADAR_HEALTHCHECK_URL) {
  $attempts = if ($env:AI_RADAR_HEALTHCHECK_ATTEMPTS) { [int]$env:AI_RADAR_HEALTHCHECK_ATTEMPTS } else { 12 }
  $intervalMs = if ($env:AI_RADAR_HEALTHCHECK_INTERVAL_MS) { [int]$env:AI_RADAR_HEALTHCHECK_INTERVAL_MS } else { 10000 }
  $healthy = $false

  for ($i = 0; $i -lt $attempts; $i++) {
    try {
      $response = Invoke-WebRequest -Uri $env:AI_RADAR_HEALTHCHECK_URL -UseBasicParsing -TimeoutSec 10
      if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 300) {
        $healthy = $true
        break
      }
    } catch {
      Start-Sleep -Milliseconds $intervalMs
    }
  }

  if (-not $healthy) {
    throw "Health check failed for $($env:AI_RADAR_HEALTHCHECK_URL)"
  }
}

$receipt.completedAt = [DateTime]::UtcNow.ToString("o")
$receipt.status = "healthy"
$receipt | ConvertTo-Json -Depth 5 | Set-Content -Path (Join-Path $stateDir "last_deploy_receipt.json") -Encoding UTF8

Remove-Item -Path (Join-Path $stateDir "pending_deploy.json") -ErrorAction SilentlyContinue

npx tsx scripts/record-successful-deploy.ts
