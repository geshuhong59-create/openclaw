# AI Architecture Radar Daily Report

- Executed at: 2026-03-29T16:41:47.067Z
- Discovered candidates: 5
- Report path: reports/2026-03-25-ai-radar.md

## Top Candidates
1. vllm-project/vllm | score=76 | release=v0.8.2 | vetoes=none
2. langchain-ai/langgraph | score=71 | release=v0.3.5 | vetoes=none
3. browser-use/browser-use | score=69 | release=v1.9.0 | vetoes=none
4. microsoft/autogen | score=66 | release=v0.6.3 | vetoes=none
5. openai/openai-agents-python | score=65 | release=v0.4.1 | vetoes=none

## Discovery Notes
- vllm-project/vllm: Active commits in last 30 days: 27; Latest release: v0.8.2; License: Apache-2.0; Projected performance gain: 37%; Projected cost reduction: 19%
- langchain-ai/langgraph: Active commits in last 30 days: 18; Latest release: v0.3.5; License: MIT; Projected performance gain: 27%; Projected cost reduction: 4%
- browser-use/browser-use: Active commits in last 30 days: 31; Latest release: v1.9.0; License: MIT; Projected performance gain: 27%; Projected cost reduction: 4%
- microsoft/autogen: Active commits in last 30 days: 12; Latest release: v0.6.3; License: MIT; Projected performance gain: 27%; Projected cost reduction: 4%
- openai/openai-agents-python: Active commits in last 30 days: 24; Latest release: v0.4.1; License: Apache-2.0; Projected performance gain: 27%; Projected cost reduction: 4%

## Auto Validation
- vllm-project/vllm@v0.8.2: dry-run | branch=upgrade/2026-03-29-vllm | report=/home/runner/work/openclaw/openclaw/reports/upgrades/upgrade-2026-03-29-vllm/UPGRADE_REPORT.md

## Failures
- executor: GitHub API 403 Forbidden: {"message":"GitHub Actions is not permitted to create or approve pull requests.","documentation_url":"https://docs.github.com/rest/pulls/pulls#create-a-pull-request","status":"403"}

## Recommendations
- No failed upgrade attempts require immediate action.
- No PR was opened automatically in this run.
- Production remains gated and must keep environment protection rules enabled.
