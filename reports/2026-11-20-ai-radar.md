# AI Architecture Radar Daily Report

- Executed at: 2026-11-20T04:53:20.013Z
- Discovered candidates: 104
- Report path: /home/runner/work/openclaw/openclaw/reports/2026-11-20-ai-radar.md

## Executive Summary
- Winner: browser-use/browser-use@1.0.6 (score 85)
- Eligible candidates in today's shortlist: 4/5
- Planned upgrade executions: 4
- Failed execution records: 0
- Auto-created upgrade PRs during planning: 2

## Top Candidate Scoreboard
| Rank | Repo | Score | Release | Perf Gain | Cost Down | Eligible | Vetoes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | browser-use/browser-use | 85 | 1.0.6 | 37% | 19% | yes | none |
| 2 | browserbase/stagehand | 74 | @browserbasehq/stagehand@3.7.4 | 27% | 4% | yes | none |
| 3 | browser-use/browser-harness | 73 | v0.1.13 | 27% | 4% | yes | none |
| 4 | vllm-project/vllm | 72 | v0.34.0 | 37% | 19% | no | breaking_change_high_risk |
| 5 | lexmount/moli | 72 | v1.1.26 | 37% | 4% | yes | none |

## Top Candidates
1. browser-use/browser-use | score=85 | release=1.0.6 | vetoes=none
2. browserbase/stagehand | score=74 | release=@browserbasehq/stagehand@3.7.4 | vetoes=none
3. browser-use/browser-harness | score=73 | release=v0.1.13 | vetoes=none
4. vllm-project/vllm | score=72 | release=v0.34.0 | vetoes=breaking_change_high_risk
5. lexmount/moli | score=72 | release=v1.1.26 | vetoes=none

## Discovery Notes
- browser-use/browser-use: Active commits in last 30 days: 100; Latest release: 1.0.6; License: MIT; Projected performance gain: 37%; Projected cost reduction: 19%
- browserbase/stagehand: Active commits in last 30 days: 87; Latest release: @browserbasehq/stagehand@3.7.4; License: MIT; Projected performance gain: 27%; Projected cost reduction: 4%
- browser-use/browser-harness: Active commits in last 30 days: 100; Latest release: v0.1.13; License: MIT; Projected performance gain: 27%; Projected cost reduction: 4%
- vllm-project/vllm: Active commits in last 30 days: 100; Latest release: v0.34.0; License: Apache-2.0; Projected performance gain: 37%; Projected cost reduction: 19%
- lexmount/moli: Active commits in last 30 days: 100; Latest release: v1.1.26; License: Apache-2.0; Projected performance gain: 37%; Projected cost reduction: 4%

## Planned Execution
- browser-use/browser-use@1.0.6 | status=skipped | branch=upgrade/2026-11-20-browser-use
  note: Skipped because this candidate version already has an upgrade attempt recorded.
- browserbase/stagehand@@browserbasehq/stagehand@3.7.4 | status=pr-created | branch=upgrade/2026-11-20-stagehand | pr=https://github.com/geshuhong59-create/openclaw/pull/160 | commit=36f4b678f4bbb2253d1badd2b4b68234fb9e776f
  note: Created PR targeting staging.
- browser-use/browser-harness@v0.1.13 | status=skipped | branch=upgrade/2026-11-20-browser-harness
  note: Skipped because this candidate version already has an upgrade attempt recorded.
- lexmount/moli@v1.1.26 | status=pr-created | branch=upgrade/2026-11-20-moli | pr=https://github.com/geshuhong59-create/openclaw/pull/161 | commit=9f3cc1e6ee3b2b51314157734b7974285bf3214c
  note: Created PR targeting staging.

## Failures
- No failures recorded.

## Recommendations
- No failed upgrade attempts require immediate action.
- Review newly opened staging PRs and decide whether to promote to canary.
- Production remains gated and must keep environment protection rules enabled.
