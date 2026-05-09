# Collector Plan

## Phase 1 Status
Completed:
- local CLI collector `pnpm collect:local`
- contract + schema validation `pnpm validate:snapshot`
- snapshot outputs:
  - `data/snapshots/nuc2/latest.json`
  - `data/snapshots/nuc2/<UTC_TIMESTAMP>.json`
  - `data/snapshots/nuc2/latest-summary.json`

## Current Behavior
- machine defaults to `nuc2` (override with `GH_TRACKER_MACHINE_ID`)
- scans `/opt/slimy` and `/home/slimy` with depth limit
- collects git metadata only
- excludes noisy directories (`node_modules`, `.next`, `dist`, `build`, `coverage`, `.cache`, `.git`)
- redacts remote credentials and token-like patterns

## Not Included Yet
- GitHub API tokens
- webhooks
- timers/cron/systemd automation

## Phase 2 Target
Ingest multiple machine snapshots (Laptop + NUC1 + NUC2), unify canonical repo graph, and build historical multi-day rollups for combined analytics.
