# Collector Contracts (Phase 1)

## Scope
Phase 1 adds a local collector contract layer and a NUC2 snapshot collector.

## Core Types
Defined in `src/lib/contracts.ts` and runtime-validated in `src/lib/snapshot-schema.ts`.

- `Machine`: physical host identity (`id`, `label`, `host`, `platform`)
- `Repo`: canonical repository identity with redacted canonical remote
- `RepoLocation`: repo clone on a machine/path with branch and sync state
- `ActivityEvent`: event stream item (`commit`, `push`, `status`)
- `DailyRepoStats`: per-repo per-day activity totals
- `DailyMachineStats`: per-machine per-day aggregates
- `CollectorRun`: collector metadata (version, timing, result, roots, errors)
- `SnapshotEnvelope`: top-level payload written by collector

## Contract Guarantees
- Supports same repo cloned on multiple machines via `repo` + `repoLocation`
- Tracks dirty, ahead (unpushed), behind (unpulled), branch, HEAD SHA
- Includes recent commit windows and additions/deletions
- Captures collector run metadata and errors for operability

## Validation
- `pnpm validate:snapshot` validates shape, required fields, redaction, and adapter parse readiness.
