# Upgrade Plan

## Candidate
- Repository: browser-use/browser-use
- Final upgrade score: 80
- Change type: tool-plugin-integration
- Risk: medium

## Planned Changes
- .openclaw/extensions/github-architecture-radar/index.ts
- .github/workflows/ai-radar-daily.yml

## Qualifying Signals
- activeLast30Days: pass
- hasStableRelease: pass
- commercialLicense: pass
- documentationComplete: pass
- compatibilityAtLeast70: pass
- projectedPerformanceGainAtLeast15Pct: pass
- projectedCostReductionAtLeast10Pct: fail
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
