# AI Radar Automation

This workspace can run a daily GitHub AI architecture scan and progress a qualifying candidate through validation, upgrade application, and staging deployment.

## What is automated

- Every day at 08:00 China Standard Time via `.github/workflows/ai-radar-daily.yml`
- Repository discovery and scoring through `scripts/run-radar.ts`
- Upgrade orchestration through `scripts/run-auto-upgrade.ts`
- Safety guardrails that block production deployment
- Manual or reusable non-production deploy path through `.github/workflows/deploy-staging.yml`
- PR validation for upgrade branches through `.github/workflows/ai-radar-pr-validate.yml`

## Default behavior

By default the system will:

- scan watched GitHub repositories and topics
- score candidates
- create upgrade artifacts and PR-ready outputs
- auto-apply the winning candidate into the repository runtime profile
- run validation
- deploy the validated branch to `staging` or `canary`

## Guardrails

- `execution.denyProduction` must remain `true`
- `execution.allowDeployTargets` is restricted to `staging` and `canary`
- `autoApplyUpgrade` stays bounded to approved paths and runtime-profile updates
- `autoDeploy` promotes only to `staging` or `canary`

## Enable full closed loop

1. Keep `execution.deployTarget` on `staging` or `canary`
2. Review `config/runtime-architecture.json` if you want different runtime defaults
3. Override these hooks only if you need custom repo-specific behavior:
   - `AI_RADAR_APPLY_COMMAND`
   - `AI_RADAR_DEPLOY_COMMAND`

By default the built-in closed loop uses:

- `npx tsx scripts/apply-radar-upgrade.ts`
- `npx tsx scripts/deploy-radar-upgrade.ts`
- `npx tsx scripts/promote-radar-deploy.ts`

You can still override the hooks with environment-backed commands instead of editing the scripts directly:

- `AI_RADAR_APPLY_COMMAND`
- `AI_RADAR_DEPLOY_COMMAND`
- `AI_RADAR_HEALTHCHECK_URL`
- `AI_RADAR_HEALTHCHECK_ATTEMPTS`
- `AI_RADAR_HEALTHCHECK_INTERVAL_MS`

The daily GitHub Actions workflow already passes these from repository variables if you define them, but it no longer depends on them for the default closed loop.

## Persisted state

Successful deploys update:

- `state/last_successful_version.json`
- `state/last_deploy_receipt.json`
- `state/last_branch_promotion.json`
- `state/deployment_smoke.json`

Daily scans and deploy workflows also try to commit `config/`, `output/`, `reports/`, and `state/` changes back to the current branch automatically.

## Local commands

```bash
npm run radar:run
npm run radar:auto-upgrade
npm run test:upgrade:ps1
```

## Reality check

This now supports a bounded closed loop: discovery, scoring, branch/PR creation, runtime-profile application, validation, and promotion to `staging`/`canary`.
It still does not permit production deployment or arbitrary credential-changing upgrades.
