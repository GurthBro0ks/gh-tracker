# Research Farm Read-Only Contract

## Status: Phase 4 Implemented

Phase 4 adds owner-gated Habitat UI routes for viewing the Research Farm.

## Canonical source

- KB repo: `/home/slimy/kb`
- Research root: `/home/slimy/kb/research`
- Read-only index: `/home/slimy/kb/research/indexes/index.json`

Habitat consumes the generated index instead of scanning the full KB tree.

## Source of truth

- Source of truth is `slimy-kb`, not guild SQLite and not Habitat-local state.
- Habitat remains read-only first.
- File access is streamed through owner-gated routes.
- PDFs are never exposed from a public directory.
- Hermes is not a dependency for the UI integration.

## Habitat routes (Phase 4)

- `GET /research` — Owner-gated overview page showing all research items
- `GET /research/runs/[runId]` — Owner-gated detail page for a specific run
- `GET /api/research/artifacts/[...path]` — Owner-gated file streaming for safe research artifacts

## Expected top-level fields

- `schema_version`
- `generated_at`
- `source_root`
- `ui_theme`
- `items`

## Expected item fields

- `immutable_run_id`
- `slug`
- `title`
- `status`
- `priority`
- `depth`
- `confidence`
- `source_count`
- `citation_count`
- `created_at`
- `started_at`
- `completed_at`
- `model_used`
- `runner_version`
- `pdf_path`
- `report_path`
- `critic_path`
- `proof_path`
- `topic_path`
- `tags`
- `related_harness_session`
- `related_guild_campaign`
- `assigned_critter`
- `almanac_path` (Phase 3+)
- `almanac_generated_at` (Phase 3+)
- `pdf_generated_at` (Phase 3+)

## Artifact path safety

- Only files under `/home/slimy/kb/research/` are served.
- Paths are normalized and resolved.
- Path traversal (`..`) is rejected.
- Absolute user-provided paths are rejected.
- Only allowed extensions: `.html`, `.pdf`, `.md`, `.json`, `.jsonl`, `.txt`.
- HTML almanacs are streamed as `text/html` through the owner-gated route with no remote dependencies.
- PDFs use `Content-Disposition: inline` with `private, no-store` cache control.

## Habitat behavior

- `/research` reads the index and buckets items into Quest Board (queued), Foraging (running), Harvest (complete), and Planned states.
- Detail pages open report/proof/source files through owner-gated server-side streaming routes.
- Habitat does not create or mutate run folders.
- No POST/PUT/PATCH/DELETE research routes exist.
- No queue controls exist.
- Navigation link added from the main dashboard header.
