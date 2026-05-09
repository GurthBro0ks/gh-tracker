# Collector Plan (Future Phases)

## Phase 1 Collector Targets
- Gather per-repo branch, dirty state, and ahead/behind state
- Gather commit and push activity windows
- Emit machine-tagged snapshots from Laptop, NUC1, NUC2

## Proposed Collection Modes
1. Local CLI collector script (manual or cron)
2. Optional daemon mode for periodic refresh
3. Optional event append log for incremental timeline

## Output Contract
- JSON snapshot files keyed by machine and capture timestamp
- Separate files for:
  - `repoLocation` status snapshot
  - `activityEvent` stream append

## Security Constraints
- No secrets in committed files
- No API token usage until Phase 4
- Local filesystem only during initial collector implementation
