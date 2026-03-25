#!/usr/bin/env bash
set -euo pipefail

node --input-type=module <<'EOF'
import fs from "node:fs";

const config = JSON.parse(fs.readFileSync("config/ai-upgrade-radar.json", "utf8"));
const lastSuccessful = JSON.parse(fs.readFileSync("state/last_successful_version.json", "utf8"));

if (config.execution.denyProduction !== true) {
  throw new Error("production auto-deploy guardrail is not enabled");
}

const targets = config.execution.allowDeployTargets || [];
if (!targets.includes("staging")) {
  throw new Error("staging must remain an allowed target");
}

if (targets.includes("production")) {
  throw new Error("production must never be an allowed target");
}

if (!lastSuccessful.environments || typeof lastSuccessful.environments !== "object") {
  throw new Error("last_successful_version.json is missing environments");
}

console.log("rollback guardrails verified");
EOF
