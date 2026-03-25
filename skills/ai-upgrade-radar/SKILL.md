# AI Upgrade Radar

Use this skill when the workspace needs a daily scan of upstream AI repos, release changes, or architecture candidates.

## Responsibilities

- Read `config/ai-upgrade-radar.json` before scanning.
- Use `radar_scan_candidates` for discovery.
- Use `radar_generate_upgrade_plan` to turn a scored candidate into an explicit plan.
- Use `radar_run_daily` or `scripts/run-radar.ts` for the full daily cycle.
- Keep all writes inside approved paths and never target production automatically.

## Output Templates

- Daily report: `templates/daily_report.md`
- Upgrade plan: `templates/upgrade_plan.md`
- PR body: `templates/pr_body.md`

## Guardrails

- Never merge directly to `main`.
- Never deploy to `production`.
- Escalate on unknown license, auth changes, breaking APIs, or ambiguous benchmarks.
