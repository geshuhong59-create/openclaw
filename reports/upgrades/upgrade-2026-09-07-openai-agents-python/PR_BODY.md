## Summary
Evaluate openai/openai-agents-python as a provider-replacement candidate on an isolated branch with staging-only validation.

## Candidate Signals
- Active commits in last 30 days: 100
- Latest release: v0.22.0
- License: MIT
- Projected performance gain: 37%
- Projected cost reduction: 9%

## Validation Checklist
- Smoke test passes on the isolated branch.
- Integration test passes against the staging profile.
- Regression suite shows no critical diff.
- Benchmark smoke confirms the projected improvement is directionally true.
- Rollback simulation restores the last successful staging version.

## Rollback Plan
- Reset the experiment branch to the last successful staging commit.
- Restore the candidate version recorded in state/last_successful_version.json.
- Re-run smoke, regression, and rollback simulation before reopening the PR.