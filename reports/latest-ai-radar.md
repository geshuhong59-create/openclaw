# AI Architecture Radar Daily Report

- Executed at: 2026-11-08T03:23:45.300Z
- Discovered candidates: 97
- Report path: /home/runner/work/openclaw/openclaw/reports/2026-11-08-ai-radar.md

## Executive Summary
- Winner: browser-use/browser-use@0.13.14 (score 83)
- Eligible candidates in today's shortlist: 3/5
- Planned upgrade executions: 3
- Failed execution records: 0
- Auto-created upgrade PRs during planning: 2

## Top Candidate Scoreboard
| Rank | Repo | Score | Release | Perf Gain | Cost Down | Eligible | Vetoes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | browser-use/browser-use | 83 | 0.13.14 | 37% | 9% | yes | none |
| 2 | paperclipai/paperclip | 77 | v2026.1106.0 | 27% | 4% | no | breaking_change_high_risk, auth_model_changed, production_secret_impact |
| 3 | esengine/DeepSeek-Reasonix | 73 | studio-v2.58.0 | 27% | 4% | yes | none |
| 4 | vllm-project/vllm | 72 | v0.33.0rc3 | 37% | 19% | no | breaking_change_high_risk |
| 5 | lexmount/moli | 72 | v1.1.22 | 37% | 4% | yes | none |

## Top Candidates
1. browser-use/browser-use | score=83 | release=0.13.14 | vetoes=none
2. paperclipai/paperclip | score=77 | release=v2026.1106.0 | vetoes=breaking_change_high_risk,auth_model_changed,production_secret_impact
3. esengine/DeepSeek-Reasonix | score=73 | release=studio-v2.58.0 | vetoes=none
4. vllm-project/vllm | score=72 | release=v0.33.0rc3 | vetoes=breaking_change_high_risk
5. lexmount/moli | score=72 | release=v1.1.22 | vetoes=none

## Discovery Notes
- browser-use/browser-use: Active commits in last 30 days: 93; Latest release: 0.13.14; License: MIT; Projected performance gain: 37%; Projected cost reduction: 9%
- paperclipai/paperclip: Active commits in last 30 days: 100; Latest release: v2026.1106.0; License: MIT; Projected performance gain: 27%; Projected cost reduction: 4%
- esengine/DeepSeek-Reasonix: Active commits in last 30 days: 100; Latest release: studio-v2.58.0; License: MIT; Projected performance gain: 27%; Projected cost reduction: 4%
- vllm-project/vllm: Active commits in last 30 days: 100; Latest release: v0.33.0rc3; License: Apache-2.0; Projected performance gain: 37%; Projected cost reduction: 19%
- lexmount/moli: Active commits in last 30 days: 100; Latest release: v1.1.22; License: Apache-2.0; Projected performance gain: 37%; Projected cost reduction: 4%

## Planned Execution
- browser-use/browser-use@0.13.14 | status=skipped | branch=upgrade/2026-11-08-browser-use
  note: Skipped because this candidate version already has an upgrade attempt recorded.
- esengine/DeepSeek-Reasonix@studio-v2.58.0 | status=pr-created | branch=upgrade/2026-11-08-deepseek-reasonix | pr=https://github.com/geshuhong59-create/openclaw/pull/148 | commit=1217a98e7ca23cbe210f7576d357f17336f20ecc
  note: Created PR targeting staging.
- lexmount/moli@v1.1.22 | status=pr-created | branch=upgrade/2026-11-08-moli | pr=https://github.com/geshuhong59-create/openclaw/pull/149 | commit=0b4fa8b1d7930882017cfc0cf982578a24c40725
  note: Created PR targeting staging.

## Failures
- No failures recorded.

## Recommendations
- No failed upgrade attempts require immediate action.
- Review newly opened staging PRs and decide whether to promote to canary.
- Production remains gated and must keep environment protection rules enabled.
