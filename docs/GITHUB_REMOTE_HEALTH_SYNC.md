# GitHub Remote Health Sync

Phase 5A/5B adds a read-only GitHub health sync for Repo Habitat with scheduled refresh and stale-data guards.

## Design
- Uses GitHub CLI (`gh`) only for read-only fetches.
- Reads candidate repos from `data/snapshots/aggregate/latest.json` after the existing ownership filter.
- Syncs only GitHub repos owned by `GurthBro0ks`.
- Excludes non-GitHub remotes, unknown owners, owner-not-allowed repos, and `NousResearch/hermes-agent`.
- Handles per-repo failures as `partial` or `failed` without stopping the whole sync.

## Auth
- Requires `gh auth status` to succeed on the host running the sync.
- Does not print, store, or commit tokens.
- The snapshot stores only `authenticated` or `not_authenticated` status.

## Storage
- Full snapshot: `data/github/remotes/latest.json`
- Summary: `data/github/remotes/latest-summary.json`
- Logs: `~/.local/state/gh-tracker/github-sync/logs/`

## Scripts
- `pnpm github:sync` — manual sync
- `pnpm validate:github` — validate snapshot shape and content
- `scripts/run-github-health-sync.sh` — safe wrapper with flock, logging, and pruning

## Scheduled Sync (systemd --user)
Units:
- `gh-tracker-github-health-sync.service` — oneshot sync via wrapper
- `gh-tracker-github-health-sync.timer` — runs every 1 hour + on boot after 3 min

Install:
```bash
systemctl --user daemon-reload
systemctl --user enable --now gh-tracker-github-health-sync.timer
```

Disable safely:
```bash
systemctl --user disable --now gh-tracker-github-health-sync.timer
```

## Stale Data Thresholds
- **Fresh**: ≤ 2 hours since last sync
- **Stale**: > 2 hours, ≤ 24 hours
- **Old**: > 24 hours
- **Missing**: never synced

The dashboard shows a freshness badge (Fresh / Stale / Old) next to the sync status.

## Safety Rules
- No GitHub mutations.
- No issues, PRs, releases, webhooks, ingestion endpoints, token storage, or auth file commits.
- No Caddy, Basic Auth, router, or firewall changes.
- Generated data is runtime data and is gitignored (`data/github/remotes/`).
