#!/usr/bin/env bash
set -euo pipefail

node --input-type=module <<'EOF'
import fs from "node:fs";

const baseline = JSON.parse(fs.readFileSync("fixtures/ai-radar/benchmark-baseline.json", "utf8"));
const candidate = JSON.parse(fs.readFileSync("fixtures/ai-radar/benchmark-candidate.json", "utf8"));

const latencyImprovementPct = ((baseline.latency_ms - candidate.latency_ms) / baseline.latency_ms) * 100;
const throughputGainPct = ((candidate.throughput_qps - baseline.throughput_qps) / baseline.throughput_qps) * 100;

if (latencyImprovementPct < 5) {
  throw new Error(`candidate latency gain too small: ${latencyImprovementPct.toFixed(2)}%`);
}

if (throughputGainPct < 10) {
  throw new Error(`candidate throughput gain too small: ${throughputGainPct.toFixed(2)}%`);
}

console.log(JSON.stringify({
  latencyImprovementPct: Number(latencyImprovementPct.toFixed(2)),
  throughputGainPct: Number(throughputGainPct.toFixed(2))
}, null, 2));
EOF
