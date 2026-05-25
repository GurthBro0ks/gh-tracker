# Data Model

## Distinctions

### machine
Physical host running repos/collector.
- `id`, `label`, `host`, `platform`

### repo
Canonical repository identity independent of any clone path.
- `id`, `name`, `owner`, `remoteKey`, `canonicalRemote`

### repoLocation
Machine-specific clone of a repo.
- `repoId`, `machineId`, `path`
- git state: `currentBranch`, `headSha`, `dirty`
- sync state: `aheadCount` (unpushed), `behindCount` (unpulled)
- working tree counters: staged/unstaged/untracked

### activityEvent
Normalized event feed by machine+repo+location.
- `type`: `commit | push | status`
- `timestamp`, `message`

### dailyRepoStats
Per-day per-repo metrics.
- `date`, `machineId`, `repoId`
- `commits`, `pushes`, `additions`, `deletions`

### dailyMachineStats
Per-day per-machine aggregate totals.

### collectorRun
Operational metadata about collection run.

### snapshotEnvelope
Top-level payload wrapping all entities with schema version.

## Phase 1 Notes
- Model is local-first and token-free.
- GitHub API/webhooks are intentionally deferred to later phases.

## Phase 4 Additions

### Multi-Machine Aggregation
- `snapshotEnvelope` now supports machine-specific snapshots from NUC1, NUC2, and Laptop
- `aggregate` snapshot merges all machine snapshots into unified view
- Machine IDs normalized: `nuc1`, `nuc2`, `laptop`
- Laptop snapshot may be pending (dashboard shows status)

### repoHealth
Health layer combining local cleanliness/sync/activity with remote placeholders.
- score (0-100) + bucket
- release health placeholder
- CI status placeholder
- PR/issue pressure placeholders
- attention reasons + care actions

### repoPet
Visual companion layer driven by repo health.
- deterministic species from stable repo seed data
- stage + mood + animation state
- stats: energy, cleanliness, focus, trust, maturity, glow
- evolution progress and care actions
