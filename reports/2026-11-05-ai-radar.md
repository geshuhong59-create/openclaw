# AI Architecture Radar Daily Report

- Executed at: 2026-11-05T04:16:01.362Z
- Discovered candidates: 92
- Report path: /home/runner/work/openclaw/openclaw/reports/2026-11-05-ai-radar.md

## Executive Summary
- Winner: browser-use/browser-use@0.13.14 (score 83)
- Eligible candidates in today's shortlist: 1/5
- Planned upgrade executions: 1
- Failed execution records: 0
- Auto-created upgrade PRs during planning: 0

## Top Candidate Scoreboard
| Rank | Repo | Score | Release | Perf Gain | Cost Down | Eligible | Vetoes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | browser-use/browser-use | 83 | 0.13.14 | 37% | 9% | yes | none |
| 2 | HKUDS/nanobot | 79 | v0.4.0 | 37% | 9% | no | breaking_change_high_risk, auth_model_changed, production_secret_impact |
| 3 | mastra-ai/mastra | 75 | @mastra/core@1.82.0 | 37% | 9% | no | license_unknown, breaking_change_high_risk |
| 4 | paperclipai/paperclip | 74 | v2026.1023.0 | 9% | 4% | no | breaking_change_high_risk, auth_model_changed, production_secret_impact |
| 5 | vllm-project/vllm | 72 | v0.33.0rc3 | 37% | 19% | no | breaking_change_high_risk |

## Top Candidates
1. browser-use/browser-use | score=83 | release=0.13.14 | vetoes=none
2. HKUDS/nanobot | score=79 | release=v0.4.0 | vetoes=breaking_change_high_risk,auth_model_changed,production_secret_impact
3. mastra-ai/mastra | score=75 | release=@mastra/core@1.82.0 | vetoes=license_unknown,breaking_change_high_risk
4. paperclipai/paperclip | score=74 | release=v2026.1023.0 | vetoes=breaking_change_high_risk,auth_model_changed,production_secret_impact
5. vllm-project/vllm | score=72 | release=v0.33.0rc3 | vetoes=breaking_change_high_risk

## Discovery Notes
- browser-use/browser-use: Active commits in last 30 days: 100; Latest release: 0.13.14; License: MIT; Projected performance gain: 37%; Projected cost reduction: 9%
- HKUDS/nanobot: Active commits in last 30 days: 100; Latest release: v0.4.0; License: MIT; Projected performance gain: 37%; Projected cost reduction: 9%
- mastra-ai/mastra: Active commits in last 30 days: 100; Latest release: @mastra/core@1.82.0; License: NOASSERTION; Projected performance gain: 37%; Projected cost reduction: 9%
- paperclipai/paperclip: Active commits in last 30 days: 100; Latest release: v2026.1023.0; License: MIT; Projected performance gain: 9%; Projected cost reduction: 4%
- vllm-project/vllm: Active commits in last 30 days: 100; Latest release: v0.33.0rc3; License: Apache-2.0; Projected performance gain: 37%; Projected cost reduction: 19%

## Planned Execution
- browser-use/browser-use@0.13.14 | status=skipped | branch=upgrade/2026-11-05-browser-use
  note: Skipped because this candidate version already has an upgrade attempt recorded.

## Failures
- No failures recorded.

## Recommendations
- No failed upgrade attempts require immediate action.
- No PR was opened automatically in this run.
- Production remains gated and must keep environment protection rules enabled.
