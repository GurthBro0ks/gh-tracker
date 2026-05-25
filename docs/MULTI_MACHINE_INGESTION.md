# Multi-Machine Snapshot Ingestion

## Overview

Phase 4A implements central multi-machine snapshot ingestion for the GH Tracker dashboard hosted on NUC1.

## Architecture

```
data/
  snapshots/
    machines/
      nuc1/
        latest.json
        history/
      nuc2/
        latest.json
        history/
      laptop/
        latest.json
        history/
    aggregate/
      latest.json
      latest-summary.json
  inbox/
    README.md
```

## Data Modes

The dashboard supports three data modes:

1. **Demo** — Simulated data for UI development
2. **Local Snapshot** — Single machine snapshot (NUC1 or NUC2)
3. **Aggregated Live Snapshots** — Combined data from all machines

## Scripts

- `pnpm collect:local` — Collect snapshot on current machine
- `pnpm validate:snapshot [path]` — Validate a snapshot file
- `pnpm import:snapshot -- <path>` — Import a snapshot into machine storage
- `pnpm aggregate:snapshots` — Merge all machine snapshots into aggregate
- `pnpm validate:aggregate` — Validate the aggregate snapshot

## Machine Identification

Machine IDs are normalized:
- `slimy-nuc1` → `nuc1`
- `slimy-nuc2` → `nuc2`
- Any hostname containing `laptop` → `laptop`

## Ownership Filtering

GH Tracker enforces repo ownership at aggregate time:

- **Default allowed GitHub owner**: `GurthBro0ks`
- Repos with GitHub remotes owned by other users/orgs are **excluded** from the aggregate/dashboard
- Excluded repos are reported in `data/snapshots/aggregate/excluded_repos_report.json`
- Local-only repos (no remote) are retained
- Broad laptop roots are treated as **discovery only** — found repos are recorded, but non-owned remotes are filtered before aggregation
- The operator can approve additional owners via `GH_TRACKER_ALLOWED_REMOTE_OWNERS` (comma-separated)
- Explicit repo-name exclusions are supported via `GH_TRACKER_EXCLUDE_REPO_NAMES`

## Security

- Snapshot ingestion is CLI/file-based only
- No public HTTP ingestion endpoint in Phase 4A
- Remote URLs are redacted before storage
- Path traversal is rejected during import
- Malformed JSON and invalid schemas are rejected

## Future Options (Documented)

- Restricted SSH copy from known machines
- Pull from known machine locations
- Signed snapshot upload
- Private LAN endpoint protected by token

## Current Status

- NUC1: Real snapshot collected and imported (24 repo locations)
- NUC2: Real snapshot collected via SSH and imported (18 repo locations)
- Laptop: Real snapshot manually imported (32 repo locations across 3 machines after ownership filter)
- Aggregate: 32 locations, 19 unique repos, 3 machines (laptop, nuc1, nuc2), 14 excluded
- GitHub remote health: Pending Phase 5

## Laptop Ingestion

Since the laptop is not reachable via SSH from NUC1, a manual export workflow is provided:
1. Run `GH_TRACKER_MACHINE_ID=laptop pnpm collect:local` on the laptop
2. Copy the generated snapshot to NUC1 via scp
3. Run `pnpm import:snapshot` and `pnpm aggregate:snapshots` on NUC1

Full instructions: `docs/LAPTOP_INGESTION_WORKFLOW.md`

### Validation Hardening

`pnpm validate:snapshot` now rejects snapshots with `repo_locations=0` for real machines.
Use `--allow-empty` or `GH_TRACKER_ALLOW_EMPTY_SNAPSHOT=1` for testing/discovery only.
This prevents uploading empty snapshots caused by wrong scan roots or symlink issues.
