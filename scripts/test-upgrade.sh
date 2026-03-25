#!/usr/bin/env bash
set -euo pipefail

echo "[smoke] building radar sources"
npm run build:radar

echo "[integration] running fixture-backed daily radar"
AI_RADAR_USE_FIXTURES=1 npx tsx scripts/run-radar.ts --dry-run --fixtures --report-date=2026-03-25

echo "[regression] checking generated report artifacts"
node --input-type=module <<'EOF'
import fs from "node:fs";

const reportPath = "reports/latest-ai-radar.md";
const jsonPath = "reports/latest-ai-radar.json";
const report = fs.readFileSync(reportPath, "utf8");
const payload = JSON.parse(fs.readFileSync(jsonPath, "utf8"));

if (!report.includes("AI Architecture Radar Daily Report")) {
  throw new Error("daily report heading missing");
}

if (!Array.isArray(payload.topCandidates) || payload.topCandidates.length === 0) {
  throw new Error("topCandidates missing from latest-ai-radar.json");
}
EOF

echo "[benchmark-smoke] running benchmark comparison"
bash scripts/benchmark.sh

echo "[rollback-simulation] verifying rollback guardrails"
bash scripts/rollback-check.sh

echo "[done] upgrade validation passed"
