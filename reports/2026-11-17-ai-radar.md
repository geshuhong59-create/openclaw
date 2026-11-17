# AI Architecture Radar Daily Report

- Executed at: 2026-11-17T05:44:01.193Z
- Discovered candidates: 99
- Report path: /home/runner/work/openclaw/openclaw/reports/2026-11-17-ai-radar.md

## Executive Summary
- Winner: browser-use/browser-use@1.0.6 (score 85)
- Eligible candidates in today's shortlist: 3/5
- Planned upgrade executions: 3
- Failed execution records: 0
- Auto-created upgrade PRs during planning: 0

## Top Candidate Scoreboard
| Rank | Repo | Score | Release | Perf Gain | Cost Down | Eligible | Vetoes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | browser-use/browser-use | 85 | 1.0.6 | 37% | 19% | yes | none |
| 2 | paperclipai/paperclip | 77 | v2026.1106.0 | 27% | 4% | no | breaking_change_high_risk, auth_model_changed, production_secret_impact |
| 3 | browserbase/stagehand | 74 | stagehand-server-v3/v3.7.7 | 27% | 4% | yes | none |
| 4 | browser-use/browser-harness | 73 | v0.1.13 | 27% | 4% | yes | none |
| 5 | vllm-project/vllm | 72 | v0.34.0 | 37% | 19% | no | breaking_change_high_risk |

## Top Candidates
1. browser-use/browser-use | score=85 | release=1.0.6 | vetoes=none
2. paperclipai/paperclip | score=77 | release=v2026.1106.0 | vetoes=breaking_change_high_risk,auth_model_changed,production_secret_impact
3. browserbase/stagehand | score=74 | release=stagehand-server-v3/v3.7.7 | vetoes=none
4. browser-use/browser-harness | score=73 | release=v0.1.13 | vetoes=none
5. vllm-project/vllm | score=72 | release=v0.34.0 | vetoes=breaking_change_high_risk

## Discovery Notes
- browser-use/browser-use: Active commits in last 30 days: 100; Latest release: 1.0.6; License: MIT; Projected performance gain: 37%; Projected cost reduction: 19%
- paperclipai/paperclip: Active commits in last 30 days: 100; Latest release: v2026.1106.0; License: MIT; Projected performance gain: 27%; Projected cost reduction: 4%
- browserbase/stagehand: Active commits in last 30 days: 100; Latest release: stagehand-server-v3/v3.7.7; License: MIT; Projected performance gain: 27%; Projected cost reduction: 4%
- browser-use/browser-harness: Active commits in last 30 days: 99; Latest release: v0.1.13; License: MIT; Projected performance gain: 27%; Projected cost reduction: 4%
- vllm-project/vllm: Active commits in last 30 days: 100; Latest release: v0.34.0; License: Apache-2.0; Projected performance gain: 37%; Projected cost reduction: 19%

## Planned Execution
- browser-use/browser-use@1.0.6 | status=skipped | branch=upgrade/2026-11-17-browser-use
  note: Skipped because this candidate version already has an upgrade attempt recorded.
- browserbase/stagehand@stagehand-server-v3/v3.7.7 | status=skipped | branch=upgrade/2026-11-17-stagehand
  note: Skipped because this candidate version already has an upgrade attempt recorded.
- browser-use/browser-harness@v0.1.13 | status=skipped | branch=upgrade/2026-11-17-browser-harness
  note: Skipped because this candidate version already has an upgrade attempt recorded.

## Failures
- No failures recorded.

## Recommendations
- No failed upgrade attempts require immediate action.
- No PR was opened automatically in this run.
- Production remains gated and must keep environment protection rules enabled.
