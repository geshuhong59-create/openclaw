# AI Architecture Radar Daily Report

- Executed at: 2026-11-19T05:02:49.225Z
- Discovered candidates: 104
- Report path: /home/runner/work/openclaw/openclaw/reports/2026-11-19-ai-radar.md

## Executive Summary
- Winner: browser-use/browser-use@1.0.6 (score 85)
- Eligible candidates in today's shortlist: 2/5
- Planned upgrade executions: 2
- Failed execution records: 0
- Auto-created upgrade PRs during planning: 1

## Top Candidate Scoreboard
| Rank | Repo | Score | Release | Perf Gain | Cost Down | Eligible | Vetoes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | browser-use/browser-use | 85 | 1.0.6 | 37% | 19% | yes | none |
| 2 | paperclipai/paperclip | 77 | v2026.1117.0 | 27% | 4% | no | breaking_change_high_risk, auth_model_changed, production_secret_impact |
| 3 | browserbase/stagehand | 74 | @browserbasehq/stagehand@3.7.4 | 27% | 4% | yes | none |
| 4 | vllm-project/vllm | 72 | v0.34.0 | 37% | 19% | no | breaking_change_high_risk |
| 5 | n8n-io/n8n | 71 | n8n@2.48.5 | 9% | 4% | no | license_unknown, benchmark_unverifiable |

## Top Candidates
1. browser-use/browser-use | score=85 | release=1.0.6 | vetoes=none
2. paperclipai/paperclip | score=77 | release=v2026.1117.0 | vetoes=breaking_change_high_risk,auth_model_changed,production_secret_impact
3. browserbase/stagehand | score=74 | release=@browserbasehq/stagehand@3.7.4 | vetoes=none
4. vllm-project/vllm | score=72 | release=v0.34.0 | vetoes=breaking_change_high_risk
5. n8n-io/n8n | score=71 | release=n8n@2.48.5 | vetoes=license_unknown,benchmark_unverifiable

## Discovery Notes
- browser-use/browser-use: Active commits in last 30 days: 100; Latest release: 1.0.6; License: MIT; Projected performance gain: 37%; Projected cost reduction: 19%
- paperclipai/paperclip: Active commits in last 30 days: 100; Latest release: v2026.1117.0; License: MIT; Projected performance gain: 27%; Projected cost reduction: 4%
- browserbase/stagehand: Active commits in last 30 days: 85; Latest release: @browserbasehq/stagehand@3.7.4; License: MIT; Projected performance gain: 27%; Projected cost reduction: 4%
- vllm-project/vllm: Active commits in last 30 days: 100; Latest release: v0.34.0; License: Apache-2.0; Projected performance gain: 37%; Projected cost reduction: 19%
- n8n-io/n8n: Active commits in last 30 days: 100; Latest release: n8n@2.48.5; License: NOASSERTION; Projected performance gain: 9%; Projected cost reduction: 4%

## Planned Execution
- browser-use/browser-use@1.0.6 | status=skipped | branch=upgrade/2026-11-19-browser-use
  note: Skipped because this candidate version already has an upgrade attempt recorded.
- browserbase/stagehand@@browserbasehq/stagehand@3.7.4 | status=pr-created | branch=upgrade/2026-11-19-stagehand | pr=https://github.com/geshuhong59-create/openclaw/pull/159 | commit=d7249b4b31b8ac36a6a54ef3c2e4006979798c53
  note: Created PR targeting staging.

## Failures
- No failures recorded.

## Recommendations
- No failed upgrade attempts require immediate action.
- Review newly opened staging PRs and decide whether to promote to canary.
- Production remains gated and must keep environment protection rules enabled.
