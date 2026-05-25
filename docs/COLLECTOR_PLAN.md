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

## Phase 4A Status (Completed)
- NUC1 + NUC2 snapshots ingested and aggregated
- Dashboard shows Aggregated Live Snapshots mode
- 42 repo locations across 2 machines, 27 unique repos

## Phase 4B Status (In Progress)
- Laptop snapshot workflow created (manual SSH export)
- Dashboard updated to show Laptop as pending or loaded
- Laptop snapshot must be real — no fabricated data
- Full instructions: `docs/LAPTOP_INGESTION_WORKFLOW.md`

## Phase 5 Target
GitHub API sync for release/CI/PR/issue health:
- Token-based, secure local-only secrets handling
- Merge remote health into RepoHealth score
- Expand pixel-pet states with sprite-sheet assets
