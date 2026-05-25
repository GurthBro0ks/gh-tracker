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

- NUC1: Real snapshot collected and imported
- NUC2: Real snapshot collected via SSH and imported
- Laptop: Pending Phase 4B
- GitHub remote health: Pending Phase 5
