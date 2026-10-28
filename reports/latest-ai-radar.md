# AI Architecture Radar Daily Report

- Executed at: 2026-10-28T03:03:59.119Z
- Discovered candidates: 103
- Report path: /home/runner/work/openclaw/openclaw/reports/2026-10-28-ai-radar.md

## Executive Summary
- Winner: browser-use/browser-use@0.13.14 (score 83)
- Eligible candidates in today's shortlist: 2/5
- Planned upgrade executions: 2
- Failed execution records: 0
- Auto-created upgrade PRs during planning: 0

## Top Candidate Scoreboard
| Rank | Repo | Score | Release | Perf Gain | Cost Down | Eligible | Vetoes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | browser-use/browser-use | 83 | 0.13.14 | 37% | 9% | yes | none |
| 2 | paperclipai/paperclip | 74 | v2026.1023.0 | 9% | 4% | no | breaking_change_high_risk, auth_model_changed, production_secret_impact |
| 3 | langchain-ai/langgraph | 73 | 1.2.18 | 27% | 4% | yes | none |
| 4 | vllm-project/vllm | 72 | v0.32.0 | 37% | 19% | no | breaking_change_high_risk |
| 5 | openai/openai-agents-python | 71 | v0.24.0 | 27% | 4% | no | none |

## Top Candidates
1. browser-use/browser-use | score=83 | release=0.13.14 | vetoes=none
2. paperclipai/paperclip | score=74 | release=v2026.1023.0 | vetoes=breaking_change_high_risk,auth_model_changed,production_secret_impact
3. langchain-ai/langgraph | score=73 | release=1.2.18 | vetoes=none
4. vllm-project/vllm | score=72 | release=v0.32.0 | vetoes=breaking_change_high_risk
5. openai/openai-agents-python | score=71 | release=v0.24.0 | vetoes=none

## Discovery Notes
- browser-use/browser-use: Active commits in last 30 days: 100; Latest release: 0.13.14; License: MIT; Projected performance gain: 37%; Projected cost reduction: 9%
- paperclipai/paperclip: Active commits in last 30 days: 100; Latest release: v2026.1023.0; License: MIT; Projected performance gain: 9%; Projected cost reduction: 4%
- langchain-ai/langgraph: Active commits in last 30 days: 100; Latest release: 1.2.18; License: MIT; Projected performance gain: 27%; Projected cost reduction: 4%
- vllm-project/vllm: Active commits in last 30 days: 100; Latest release: v0.32.0; License: Apache-2.0; Projected performance gain: 37%; Projected cost reduction: 19%
- openai/openai-agents-python: Active commits in last 30 days: 100; Latest release: v0.24.0; License: MIT; Projected performance gain: 27%; Projected cost reduction: 4%

## Planned Execution
- browser-use/browser-use@0.13.14 | status=skipped | branch=upgrade/2026-10-28-browser-use
  note: Skipped because this candidate version already has an upgrade attempt recorded.
- langchain-ai/langgraph@1.2.18 | status=skipped | branch=upgrade/2026-10-28-langgraph
  note: Skipped because this candidate version already has an upgrade attempt recorded.

## Failures
- No failures recorded.

## Recommendations
- No failed upgrade attempts require immediate action.
- No PR was opened automatically in this run.
- Production remains gated and must keep environment protection rules enabled.
