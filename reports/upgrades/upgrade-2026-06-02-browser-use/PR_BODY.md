## Summary
Evaluate browser-use/browser-use as a tool-plugin-integration candidate on an isolated branch with staging-only validation.

## Candidate Signals
- Active commits in last 30 days: 98
- Latest release: 0.12.9
- License: MIT
- Projected performance gain: 27%
- Projected cost reduction: 4%

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