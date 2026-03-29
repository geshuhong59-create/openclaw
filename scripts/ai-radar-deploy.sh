#!/usr/bin/env bash
set -euo pipefail

mkdir -p state
STARTED_AT="$(node --input-type=module -e "console.log(new Date().toISOString())")"

cat > state/pending_deploy.json <<EOF
{
  "candidateKey": "${AI_RADAR_CANDIDATE_KEY:-unknown}",
  "repository": "${AI_RADAR_CANDIDATE_REPO:-unknown}",
  "releaseTag": "${AI_RADAR_CANDIDATE_RELEASE:-unknown}",
  "branchName": "${AI_RADAR_BRANCH_NAME:-unknown}",
  "deployTarget": "${AI_RADAR_DEPLOY_TARGET:-staging}",
  "startedAt": "${STARTED_AT}"
}
EOF

if [[ -z "${AI_RADAR_DEPLOY_COMMAND:-}" ]]; then
  AI_RADAR_DEPLOY_COMMAND="npx tsx scripts/deploy-radar-upgrade.ts"
fi

echo "[deploy] executing configured deployment command"
bash -lc "${AI_RADAR_DEPLOY_COMMAND}"

if [[ -n "${AI_RADAR_HEALTHCHECK_URL:-}" ]]; then
  ATTEMPTS="${AI_RADAR_HEALTHCHECK_ATTEMPTS:-12}"
  INTERVAL_MS="${AI_RADAR_HEALTHCHECK_INTERVAL_MS:-10000}"
  SUCCESS=0

  for ((i=1; i<=ATTEMPTS; i++)); do
    if node --input-type=module -e "const res = await fetch(process.env.AI_RADAR_HEALTHCHECK_URL); if (!res.ok) process.exit(1);"; then
      SUCCESS=1
      break
    fi
    sleep "$(node --input-type=module -e "console.log((${INTERVAL_MS})/1000)")"
  done

  if [[ "$SUCCESS" != "1" ]]; then
    echo "Health check failed for ${AI_RADAR_HEALTHCHECK_URL}" >&2
    exit 1
  fi
fi

COMPLETED_AT="$(node --input-type=module -e "console.log(new Date().toISOString())")"

cat > state/last_deploy_receipt.json <<EOF
{
  "candidateKey": "${AI_RADAR_CANDIDATE_KEY:-unknown}",
  "repository": "${AI_RADAR_CANDIDATE_REPO:-unknown}",
  "releaseTag": "${AI_RADAR_CANDIDATE_RELEASE:-unknown}",
  "branchName": "${AI_RADAR_BRANCH_NAME:-unknown}",
  "deployTarget": "${AI_RADAR_DEPLOY_TARGET:-staging}",
  "startedAt": "${STARTED_AT}",
  "completedAt": "${COMPLETED_AT}",
  "status": "healthy"
}
EOF

rm -f state/pending_deploy.json

npx tsx scripts/record-successful-deploy.ts
