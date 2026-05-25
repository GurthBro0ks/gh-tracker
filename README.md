# gh-tracker

Local dashboard for tracking Git/GitHub activity across Laptop, NUC1, and NUC2.

## Phase 1
- Collector contracts implemented (`src/lib/contracts.ts`, `src/lib/snapshot-schema.ts`)
- Local collector implemented (`pnpm collect:local`)
- Snapshot validation implemented (`pnpm validate:snapshot`)

## Phase 2 (Repo Habitat)
- Added `RepoHealth` contracts with local score + remote sync placeholders.
- Added deterministic original repo pets (no random identity drift).
- Added Repo Habitat dashboard section with pixel-style placeholder sprites.
- Added ReleaseBar-inspired "not synced yet" health placeholders for release, CI, PR, and issues.

## Phase 4A (Multi-Machine Ingestion)
- Central snapshot storage: `data/snapshots/machines/<machineId>/`
- Import script: `pnpm import:snapshot -- <path>`
- Aggregate script: `pnpm aggregate:snapshots`
- Aggregate validation: `pnpm validate:aggregate`
- Dashboard supports Demo, Local Snapshot, and Aggregated modes
- Real NUC1 + NUC2 snapshots imported and aggregated
- Laptop support pending Phase 4B
- No public HTTP ingestion endpoint (CLI-only)

## Run Local
```bash
pnpm install
pnpm collect:local
pnpm validate:snapshot
pnpm aggregate:snapshots
pnpm validate:aggregate
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
- `data/snapshots/machines/<machineId>/latest.json`
- `data/snapshots/machines/<machineId>/history/<timestamp>.json`
- `data/snapshots/aggregate/latest.json`
- `data/snapshots/aggregate/latest-summary.json`

## Why no GitHub API/webhooks yet
Current implementation is intentionally local and safe: git metadata from local clones only, no tokens, no webhook infrastructure. Repo Habitat includes placeholders so health UX can ship before remote sync wiring.

## Pixel Pet Asset Policy
- Pets are original retro virtual-pet inspired Slimy.ai designs.
- No official Tamagotchi characters, sprites, names, or copied layouts.

## Docs
- `docs/PROJECT_PLAN.md`
- `docs/PHASES.md`
- `docs/DATA_MODEL.md`
- `docs/REPO_HABITAT_PLAN.md`
- `docs/REPO_HEALTH_MODEL.md`
- `docs/PIXEL_PET_SYSTEM.md`
- `docs/COLLECTOR_PLAN.md`
- `docs/COLLECTOR_CONTRACTS.md`
- `docs/VISUAL_STYLE.md`
- `docs/HARNESS_RULES.md`
