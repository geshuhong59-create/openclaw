$ErrorActionPreference = "Stop"

function Invoke-StrictCommand {
    param(
        [Parameter(Mandatory = $true)]
        [scriptblock]$Command
    )

    & $Command
    if ($LASTEXITCODE -ne 0) {
        throw "Command failed with exit code $LASTEXITCODE"
    }
}

Write-Host "[smoke] building radar sources"
Invoke-StrictCommand { npm run build:radar | Out-Host }

Write-Host "[integration] running fixture-backed daily radar"
$env:AI_RADAR_USE_FIXTURES = "1"
Invoke-StrictCommand { npx tsx scripts/run-radar.ts --dry-run --fixtures --report-date=2026-03-25 | Out-Host }
Remove-Item Env:AI_RADAR_USE_FIXTURES -ErrorAction SilentlyContinue

Write-Host "[regression] checking generated report artifacts"
Invoke-StrictCommand { node --input-type=module -e "import fs from 'node:fs'; const report = fs.readFileSync('reports/latest-ai-radar.md','utf8'); const payload = JSON.parse(fs.readFileSync('reports/latest-ai-radar.json','utf8')); if (!report.includes('AI Architecture Radar Daily Report')) throw new Error('daily report heading missing'); if (!Array.isArray(payload.topCandidates) || payload.topCandidates.length === 0) throw new Error('topCandidates missing'); console.log('report artifacts verified');" | Out-Host }

Write-Host "[benchmark-smoke] running benchmark comparison"
Invoke-StrictCommand { node --input-type=module -e "import fs from 'node:fs'; const baseline = JSON.parse(fs.readFileSync('fixtures/ai-radar/benchmark-baseline.json','utf8')); const candidate = JSON.parse(fs.readFileSync('fixtures/ai-radar/benchmark-candidate.json','utf8')); const latency=((baseline.latency_ms-candidate.latency_ms)/baseline.latency_ms)*100; const throughput=((candidate.throughput_qps-baseline.throughput_qps)/baseline.throughput_qps)*100; if (latency < 5) throw new Error('candidate latency gain too small'); if (throughput < 10) throw new Error('candidate throughput gain too small'); console.log(JSON.stringify({ latencyImprovementPct:Number(latency.toFixed(2)), throughputGainPct:Number(throughput.toFixed(2)) }, null, 2));" | Out-Host }

Write-Host "[rollback-simulation] verifying rollback guardrails"
Invoke-StrictCommand { node --input-type=module -e "import fs from 'node:fs'; const config = JSON.parse(fs.readFileSync('config/ai-upgrade-radar.json','utf8')); const lastSuccessful = JSON.parse(fs.readFileSync('state/last_successful_version.json','utf8')); if (config.execution.denyProduction !== true) throw new Error('production auto-deploy guardrail is not enabled'); if ((config.execution.allowDeployTargets || []).includes('production')) throw new Error('production must never be allowed'); if (!lastSuccessful.environments || typeof lastSuccessful.environments !== 'object') throw new Error('missing environments'); console.log('rollback guardrails verified');" | Out-Host }

Write-Host "[done] upgrade validation passed"
