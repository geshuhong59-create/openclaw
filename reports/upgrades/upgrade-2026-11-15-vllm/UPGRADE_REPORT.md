# Upgrade Plan

## Candidate
- Repository: vllm-project/vllm
- Final upgrade score: 76
- Change type: inference-framework-replacement
- Risk: high

## Planned Changes
- config/ai-upgrade-radar.json
- scripts/benchmark.sh
- scripts/rollback-check.sh
- .github/workflows/deploy-staging.yml

## Qualifying Signals
- activeLast30Days: pass
- hasStableRelease: pass
- commercialLicense: pass
- documentationComplete: fail
- compatibilityAtLeast70: pass
- projectedPerformanceGainAtLeast15Pct: pass
- projectedCostReductionAtLeast10Pct: pass
- avoidsProductionSecurityBoundary: pass

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

## Human Escalation Triggers
- Escalate if production deployment is requested.
- Escalate if the release notes imply a breaking API migration.
- Escalate if license status is unknown or incompatible.
- Escalate if benchmark outcomes are ambiguous.
