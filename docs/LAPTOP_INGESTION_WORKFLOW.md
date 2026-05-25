# Laptop Snapshot Ingestion Workflow

## Status

Laptop snapshot is **pending manual import**. NUC1 and NUC2 are already aggregated.

## Why Manual?

The laptop is not reachable via SSH from NUC1 (no configured SSH alias/key). To avoid:
- Modifying SSH config
- Creating new keys
- Prompting for passwords in automation
- Brute-forcing hostnames

We use a safe manual export workflow instead.

## Prerequisites

- Laptop has git, Node.js, and pnpm installed
- Laptop has SSH access to NUC1 (via Tailscale: `nuc1-ts`)

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
git clone git@github.com:GurthBro0ks/gh-tracker.git
cd gh-tracker
pnpm install
```

## Step 2: Collect Laptop Snapshot

```bash
cd /opt/slimy/gh-tracker || cd ~/Projects/gh-tracker
GH_TRACKER_MACHINE_ID=laptop pnpm collect:local
GH_TRACKER_MACHINE_ID=laptop pnpm validate:snapshot
```

## Step 3: Verify Snapshot Created

```bash
ls -la data/snapshots/machines/laptop/latest.json
```

## Step 4: Transfer to NUC1

```bash
# From laptop:
scp data/snapshots/machines/laptop/latest.json \
  slimy@nuc1-ts:/opt/slimy/gh-tracker/data/inbox/laptop-latest.json
```

## Step 5: Import on NUC1

```bash
ssh slimy@nuc1-ts
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
- Machines: NUC1, NUC2, Laptop
- Machine count: 3
- Laptop status: Loaded (with timestamp)

## No Public Upload Endpoint

There is no public HTTP endpoint for uploading snapshots. All transfers happen via SSH/scp between trusted machines.

## Safety Rules

- Do not fabricate laptop data
- Do not use demo data as real laptop data
- Only real `pnpm collect:local` snapshots are valid
- If laptop is unavailable, dashboard shows "Laptop pending manual snapshot import"
