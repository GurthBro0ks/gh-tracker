# GH Tracker Phases

## Phase -1
Inspection and readiness checks (repo identity, harness lane, toolchain, proof pack).

## Phase 0
Scaffold local app with demo data and dashboard shell.

## Phase 1
Implement local machine collectors for Git status, branch, commit, and push metadata.

## Phase 2
Implement ingestion and normalization into `machine`, `repo`, `repoLocation`, `activityEvent` structures.

## Phase 3
Add local persistence, scheduled refresh, and resilient cache behavior.

## Phase 4
Add optional GitHub API sync (token-based, secure local-only secrets handling).

## Phase 5
Refine visual analytics, filtering, and cross-machine historical insights.
