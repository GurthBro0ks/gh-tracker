# gh-tracker

Local dashboard for tracking Git/GitHub activity across Laptop, NUC1, and NUC2.

## Phase 1
- Collector contracts implemented (`src/lib/contracts.ts`, `src/lib/snapshot-schema.ts`)
- Local NUC2 collector implemented (`pnpm collect:local`)
- Snapshot validation implemented (`pnpm validate:snapshot`)
- Dashboard supports Demo and Local Snapshot modes
- No GitHub API tokens and no webhooks yet

## Run Local
```bash
pnpm install
pnpm collect:local
pnpm validate:snapshot
pnpm dev --port 5055
```

Open `http://127.0.0.1:5055`.

## Validate
```bash
pnpm lint
pnpm typecheck
pnpm build
```

## Collector Output
- `data/snapshots/nuc2/latest.json`
- `data/snapshots/nuc2/<UTC_TIMESTAMP>.json`
- `data/snapshots/nuc2/latest-summary.json`

## Why no GitHub API/webhooks yet
Phase 1 is intentionally local and safe: git metadata from local clones only, no tokens, no webhook infrastructure. Phase 2 will focus on multi-machine ingestion and normalization; GitHub API sync is a later phase.

## Docs
- `docs/PROJECT_PLAN.md`
- `docs/PHASES.md`
- `docs/DATA_MODEL.md`
- `docs/COLLECTOR_PLAN.md`
- `docs/COLLECTOR_CONTRACTS.md`
- `docs/VISUAL_STYLE.md`
- `docs/HARNESS_RULES.md`
