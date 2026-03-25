# Acceptance Checklist

## Functional

- [x] GitHub repository scanning pipeline exists for watched repos and topics.
- [x] Latest release lookup is implemented with GitHub REST API semantics.
- [x] Candidate scoring emits explicit numeric criteria and hard veto reasons.
- [x] Upgrade executor can prepare isolated branch artifacts and PR metadata.
- [x] Daily report generation is persisted under `reports/`.

## Safety

- [x] Production deployment is blocked in config and workflows.
- [x] `AGENTS.md` contains explicit forbidden actions and escalation triggers.
- [x] Secrets are externalized through environment variables.
- [x] Unapproved plugins are not trusted by default.

## Stability

- [x] State files persist scan history, release history, upgrade attempts, and failures.
- [x] Fixture-backed regression path exists for local verification.
- [x] Benchmark smoke and rollback simulation scripts are included.
- [x] Repeated candidate attempts are skipped via `state/upgrade_attempts.json`.
