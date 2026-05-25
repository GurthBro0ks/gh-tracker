# GitHub Remote Health Sync

Phase 5A.1 adds a read-only GitHub health sync for Repo Habitat.

## Design
- Uses GitHub CLI (`gh`) only for read-only fetches.
- Reads candidate repos from `data/snapshots/aggregate/latest.json` after the existing ownership filter.
- Syncs only GitHub repos owned by `GurthBro0ks`.
- Excludes non-GitHub remotes, unknown owners, owner-not-allowed repos, and `NousResearch/hermes-agent`.
- Handles per-repo failures as `partial` or `failed` without stopping the whole sync.

## Auth
- Requires `gh auth status` to succeed on the host running the sync.
- Does not print, store, or commit tokens.
- The snapshot stores only `authenticated` or `not_authenticated` status.

## Storage
- Full snapshot: `data/github/remotes/latest.json`
- Summary: `data/github/remotes/latest-summary.json`

## Scripts
- `pnpm github:sync` writes the latest read-only GitHub health snapshot.
- `pnpm validate:github` validates shape, ownership, excluded repos, warning accounting, and secret-like strings.

## Safety Rules
- No GitHub mutations.
- No issues, PRs, releases, webhooks, ingestion endpoints, token storage, or auth file commits.
- No Caddy, Basic Auth, router, or firewall changes.
