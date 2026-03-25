# Post Run Report Hook

Purpose: keep a lightweight pointer to the latest AI radar report after a run completes.

When enabled, this hook writes `reports/latest-ai-radar-pointer.json` so downstream automation can discover the newest report without parsing directory listings.
