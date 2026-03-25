# OpenClaw AI Upgrade Radar Workspace

This workspace now includes a daily `AI Architecture Radar + Auto-Validation Agent` scaffold for OpenClaw.

The legacy `src/` TypeScript app remains untouched. The new automation layer lives alongside it under `.openclaw/extensions/`, `config/`, `scripts/`, `state/`, `reports/`, and `.github/workflows/`.

## What It Does

- Scans watched GitHub repos and topics every morning.
- Scores candidates with explicit numeric criteria and hard veto reasons.
- Generates upgrade plans for candidates that clear the threshold.
- Prepares isolated upgrade branch artifacts and PR metadata targeting `staging`.
- Runs smoke, regression, benchmark-smoke, and rollback validation scripts.
- Persists scan and upgrade history locally.
- Keeps deployment restricted to `staging` and `canary`.

## Directory Highlights

- `.openclaw/extensions/github-architecture-radar/`: scanner, scorer, planner, executor, reporter, plugin entry, skill templates, and hook scaffolding.
- `config/ai-upgrade-radar.json`: watched repos/topics, thresholds, approved paths, and execution guardrails.
- `scripts/run-radar.ts`: end-to-end runner.
- `scripts/test-upgrade.sh`: smoke/integration/regression/benchmark/rollback smoke wrapper.
- `state/`: scan history, release history, upgrade attempts, last successful versions, and failure registry.
- `reports/`: generated daily reports and upgrade reports.
- `.github/workflows/`: daily scan, PR validation, and staging-only deploy workflows.

## Setup

1. Install dependencies.

```bash
npm install
```

2. Provide GitHub credentials through environment variables when you want live GitHub API access.

```bash
setx GITHUB_TOKEN "your_token_here"
```

3. Build the radar sources.

```bash
npm run build:radar
```

4. Bootstrap local prerequisites and ensure a `staging` branch exists.

```bash
npm run radar:bootstrap
```

5. Run a fixture-backed dry run locally.

```bash
npm run radar:dry-run
```

6. Run against live GitHub data.

```bash
npm run radar:run
```

7. Connect the workspace to a real GitHub repository when you are ready.

```bash
npm run radar:connect -- --repo=owner/repo
```

The connect script rejects placeholder values like `owner/repo`; replace them with the real repository name.

If you already have the full remote URL:

```bash
npm run radar:connect -- --repo-url=https://github.com/owner/repo.git
```

To enable automatic push and PR creation in the config during that step:

```bash
npm run radar:connect -- --repo=owner/repo --enable-auto-push --enable-auto-pr
```

`GITHUB_TOKEN` is used for GitHub REST API scans and PR creation. Local `git push` still depends on your configured git credential helper, such as Git Credential Manager on Windows.

## OpenClaw Operations

- Plugin id: `github-architecture-radar`
- Tool names:
  - `radar_scan_candidates`
  - `radar_generate_upgrade_plan`
  - `radar_run_daily`
- Recommended cron time: `07:30` Asia/Shanghai every day.
- Recommended target branch: `staging`
- Allowed deploy targets: `staging`, `canary`

Recommended local command for the daily cycle:

```bash
openclaw cron add --name "AI Upgrade Radar" --agent main --cron "30 7 * * *" --tz "Asia/Shanghai" --session isolated --session-key "agent:main:ai-upgrade-radar" --message "Run the AI architecture radar daily cycle for the workspace. Use radar_run_daily with dryRun=false when staging-only validation is safe. Never target production." --expect-final --light-context
```

If the repo has no `origin` remote or no `gh` CLI, the radar still writes `PR_BODY.md` and `pr-metadata.json` under each upgrade report so PR creation can be completed later without rerunning discovery.

## GitHub Actions

- `ai-radar-daily.yml`: scheduled at `23:30 UTC`, which is `07:30` Asia/Shanghai.
- `ai-radar-pr-validate.yml`: runs on PRs targeting `staging`.
- `deploy-staging.yml`: deploys only to `staging` or `canary`, never `production`.

Repository administrators still need to configure GitHub Environment protection rules for `staging`, `canary`, and especially `production`. The workflows intentionally omit any automatic production path.

## Verification

- Local verification script: `bash scripts/test-upgrade.sh`
- Windows verification script: `powershell -ExecutionPolicy Bypass -File scripts/test-upgrade.ps1`
- Example report: `reports/examples/2026-03-25-ai-radar-daily.md`
- Acceptance checklist: `ACCEPTANCE_CHECKLIST.md`
