# AI Architecture Radar Daily Report

- Executed at: 2026-11-23T04:45:55.413Z
- Discovered candidates: 106
- Report path: /home/runner/work/openclaw/openclaw/reports/2026-11-23-ai-radar.md

## Executive Summary
- Winner: browser-use/browser-use@1.0.8 (score 85)
- Eligible candidates in today's shortlist: 0/5
- Planned upgrade executions: 0
- Failed execution records: 0
- Auto-created upgrade PRs during planning: 0

## Top Candidate Scoreboard
| Rank | Repo | Score | Release | Perf Gain | Cost Down | Eligible | Vetoes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | browser-use/browser-use | 85 | 1.0.8 | 37% | 19% | no | auth_model_changed, production_secret_impact |
| 2 | vllm-project/vllm | 72 | v0.34.0 | 37% | 19% | no | breaking_change_high_risk |
| 3 | openai/openai-agents-python | 71 | v0.25.0 | 27% | 4% | no | auth_model_changed, production_secret_impact |
| 4 | langchain-ai/langgraph | 70 | 1.2.24 | 9% | 4% | no | none |
| 5 | citrolabs/ego-lite | 66 | v2.2.1 | 27% | 14% | no | none |

## Top Candidates
1. browser-use/browser-use | score=85 | release=1.0.8 | vetoes=auth_model_changed,production_secret_impact
2. vllm-project/vllm | score=72 | release=v0.34.0 | vetoes=breaking_change_high_risk
3. openai/openai-agents-python | score=71 | release=v0.25.0 | vetoes=auth_model_changed,production_secret_impact
4. langchain-ai/langgraph | score=70 | release=1.2.24 | vetoes=none
5. citrolabs/ego-lite | score=66 | release=v2.2.1 | vetoes=none

## Discovery Notes
- browser-use/browser-use: Active commits in last 30 days: 100; Latest release: 1.0.8; License: MIT; Projected performance gain: 37%; Projected cost reduction: 19%
- vllm-project/vllm: Active commits in last 30 days: 100; Latest release: v0.34.0; License: Apache-2.0; Projected performance gain: 37%; Projected cost reduction: 19%
- openai/openai-agents-python: Active commits in last 30 days: 93; Latest release: v0.25.0; License: MIT; Projected performance gain: 27%; Projected cost reduction: 4%
- langchain-ai/langgraph: Active commits in last 30 days: 100; Latest release: 1.2.24; License: MIT; Projected performance gain: 9%; Projected cost reduction: 4%
- citrolabs/ego-lite: Active commits in last 30 days: 100; Latest release: v2.2.1; License: MIT; Projected performance gain: 27%; Projected cost reduction: 14%

## Planned Execution
- No upgrade plans crossed the execution threshold.

## Failures
- No failures recorded.

## Recommendations
- No failed upgrade attempts require immediate action.
- No PR was opened automatically in this run.
- Production remains gated and must keep environment protection rules enabled.
