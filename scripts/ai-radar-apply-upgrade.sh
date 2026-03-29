#!/usr/bin/env bash
set -euo pipefail

mkdir -p state

report_path="${AI_RADAR_REPORT_PATH:-unknown}"
if [[ "${report_path}" = /* ]]; then
  report_path="$(node -e "const path=require('path'); console.log(path.relative(process.cwd(), process.argv[1]).replace(/\\\\/g, '/'))" "${report_path}")"
fi

cat > state/pending_upgrade.json <<EOF
{
  "candidateKey": "${AI_RADAR_CANDIDATE_KEY:-unknown}",
  "repository": "${AI_RADAR_CANDIDATE_REPO:-unknown}",
  "releaseTag": "${AI_RADAR_CANDIDATE_RELEASE:-unknown}",
  "branchName": "${AI_RADAR_BRANCH_NAME:-unknown}",
  "reportPath": "${report_path}"
}
EOF

if [[ -z "${AI_RADAR_APPLY_COMMAND:-}" ]]; then
  AI_RADAR_APPLY_COMMAND="npx tsx scripts/apply-radar-upgrade.ts"
fi

echo "[apply] executing configured upgrade command"
bash -lc "${AI_RADAR_APPLY_COMMAND}"

rm -f state/pending_upgrade.json
