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

## Phase 4
Add optional GitHub API sync (token-based, secure local-only secrets handling).

## Phase 5
Refine visual analytics, filtering, and cross-machine historical insights.
