# GH Tracker Phases

## Phase -1
Inspection and readiness checks (repo identity, harness lane, toolchain, proof pack).

## Phase 0
Scaffold local app with demo data and dashboard shell.

## Phase 1
Implement local machine collector contracts, NUC2 snapshot collection, schema validation, and dashboard local/demo data mode support.

## Phase 2
Implement Repo Habitat foundation:
- Repo health model contracts and scoring buckets.
- ReleaseBar-inspired placeholders for release/CI/PR/issue sync.
- Deterministic original pixel repo pets.
- Habitat dashboard section (without GitHub API sync).

## Phase 3
Implement GitHub health ingestion and evolution rules:
- Optional secure GitHub API sync for release/CI/PR/issues.
- Merge remote health into RepoHealth score.
- Expand pixel-pet states with sprite-sheet assets.
- Add habitat history and trend persistence.

### Phase 3G — Mobile Public QA Polish
Mobile-focused layout improvements for the public dashboard:
- Safe-area padding for iOS status bar using `env(safe-area-inset-top)`.
- Collapsible filter panel on mobile (hidden by default, toggle accessible).
- Compact 4-metric KPI strip above the fold on small screens.
- Horizontal-scrollable habitat quick-view strip on mobile.
- Clearer data mode indicators (Demo vs NUC2 Snapshot).
- Responsive font/padding scaling across all dashboard sections.
- Preserved full desktop layout with conditional responsive classes.

### Phase 3H — Mobile Chart/UX Polish
Small mobile UX polish pass before Phase 4:
- Recharts tooltips restyled with dark purple/black background, neon border, and lime text (no white boxes).
- Bottom safe-area padding added via `env(safe-area-inset-bottom)` to prevent iOS browser bar from covering content.
- Repo Habitat copy cleaned up: repo name is now the primary title, species/stage/mood moved to secondary line.
- Debug/status dock clarified for Demo mode (shows "Demo (simulated)", "pending Phase 4 collector", "not connected on public deploy").
- Placeholder pixel pet art clearly labeled with "Phase 2 Preview" badge and note about sprite-sheet phase.
- Preserved full desktop layout with responsive CSS.

## Phase 4
Multi-machine snapshot ingestion and aggregation.

### Phase 4A — Multi-Machine Ingestion
- Central snapshot storage layout: `data/snapshots/machines/<machineId>/`
- Import/aggregate/validate CLI scripts
- Real NUC1 + NUC2 snapshot collection via SSH
- Aggregate dashboard mode with computed cross-machine stats
- Security: CLI-only ingestion, no public HTTP endpoint

### Phase 4B — Laptop Sync
- Laptop snapshot collection and import
- Automated sync via cron/systemd timer (documented)

## Phase 5
GitHub API sync for release/CI/PR/issue health:
- Token-based, secure local-only secrets handling
- Merge remote health into RepoHealth score
- Expand pixel-pet states with sprite-sheet assets
