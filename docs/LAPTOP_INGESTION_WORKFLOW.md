# Laptop Snapshot Ingestion Workflow

## Status

Laptop snapshot is **loaded** when `data/snapshots/machines/laptop/latest.json` exists and passes validation.

## Why Manual?

The laptop is not reachable via SSH from NUC1 (no configured SSH alias/key). To avoid:
- Modifying SSH config
- Creating new keys
- Prompting for passwords in automation
- Brute-forcing hostnames

We use a safe manual export workflow instead.

## Prerequisites

- Laptop has git, Node.js, and pnpm installed
- Laptop has SSH access to NUC1 (Tailscale or LAN)

## Step 1: Clone or Update gh-tracker on Laptop

```bash
# If gh-tracker already exists on laptop
cd /opt/slimy/gh-tracker || cd ~/Projects/gh-tracker || cd ~/projects/gh-tracker
git remote -v
git fetch origin
git pull --ff-only origin main
pnpm install
```

Or fresh clone:
```bash
mkdir -p ~/Projects
cd ~/Projects
# Try SSH first; fall back to HTTPS if GitHub SSH is unavailable
git clone git@github.com:GurthBro0ks/gh-tracker.git || \
  git clone https://github.com/GurthBro0ks/gh-tracker.git
cd gh-tracker
pnpm install
```

## Step 2: Collect Laptop Snapshot

Use the **real scan roots** that exist on the laptop (symlink roots are skipped by the collector):

```bash
cd /opt/slimy/gh-tracker || cd ~/Projects/gh-tracker
export GH_TRACKER_SCAN_ROOTS="$HOME/Projects,$HOME/Standalone,$HOME/slimy-dev,$HOME/Desktop"
export GH_TRACKER_MACHINE_ID=laptop
pnpm collect:local
pnpm validate:snapshot
```

If `pnpm` is broken before the workspace fix is applied, use the tsx fallback:
```bash
npx tsx scripts/collect-local.ts
npx tsx scripts/validate-snapshot.ts
```

## Step 3: Verify Snapshot Created

```bash
ls -la data/snapshots/machines/laptop/latest.json
```

**CRITICAL:** If `repo_locations=0`, do **not** upload the snapshot.
- Zero repos means the collector found nothing (wrong roots, permission issues, or symlinks not followed).
- Fix the scan roots and re-run before transferring.

## Step 4: Transfer to NUC1

```bash
# From laptop:
scp data/snapshots/machines/laptop/latest.json \
  slimy@nuc1:/opt/slimy/gh-tracker/data/inbox/laptop-latest.json
```

If `nuc1` SSH alias is not configured, use the Tailscale address:
```bash
scp data/snapshots/machines/laptop/latest.json \
  slimy@nuc1-ts:/opt/slimy/gh-tracker/data/inbox/laptop-latest.json
```

## Step 5: Import on NUC1

```bash
ssh slimy@nuc1
cd /opt/slimy/gh-tracker
pnpm import:snapshot -- data/inbox/laptop-latest.json
pnpm validate:snapshot -- data/snapshots/machines/laptop/latest.json
pnpm aggregate:snapshots
pnpm validate:aggregate
systemctl --user restart gh-tracker.service
systemctl --user is-active gh-tracker.service
curl -I http://127.0.0.1:5055
```

## Expected Result

Dashboard should show:
- Data Mode: Aggregated Live Snapshots
- Machines: Laptop, NUC1, NUC2
- Machine count: 3
- Laptop status: Loaded (with timestamp)

## No Public Upload Endpoint

There is no public HTTP endpoint for uploading snapshots. All transfers happen via SSH/scp between trusted machines.

## Ownership Filtering

The laptop collector may scan broad folders (`~/Projects`, `~/Desktop`, etc.) and discover repos the operator does not own. GH Tracker filters these out automatically:

- **Default allowed GitHub owner**: `GurthBro0ks`
- Repos with GitHub remotes owned by other users/orgs are **excluded** from the aggregate dashboard
- Excluded repos are listed in `data/snapshots/aggregate/excluded_repos_report.json` — they are reported, not silently hidden
- Local-only repos (no remote) are retained
- The operator can add more allowed owners later via the `GH_TRACKER_ALLOWED_REMOTE_OWNERS` env var (comma-separated)

This means the laptop snapshot is treated as **discovery only**: all found repos are captured, but only owned/approved repos make it into the dashboard.

## Safety Rules

- Do not fabricate laptop data
- Do not use demo data as real laptop data
- Only real `pnpm collect:local` snapshots are valid
- Do not upload snapshots with `repo_locations=0` — fix roots and retry
- If laptop is unavailable, dashboard shows "Laptop pending manual snapshot import"
