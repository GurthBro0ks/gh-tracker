# gh-tracker

Local dashboard for tracking Git/GitHub activity across Laptop, NUC1, and NUC2.

## Phase 1
- Collector contracts implemented (`src/lib/contracts.ts`, `src/lib/snapshot-schema.ts`)
- Local NUC2 collector implemented (`pnpm collect:local`)
- Snapshot validation implemented (`pnpm validate:snapshot`)
- Dashboard supports Demo and Local Snapshot modes
- No GitHub API tokens and no webhooks yet

## Phase 2 (Repo Habitat)
- Added `RepoHealth` contracts with local score + remote sync placeholders.
- Added deterministic original repo pets (no random identity drift).
- Added Repo Habitat dashboard section with pixel-style placeholder sprites.
- Added ReleaseBar-inspired "not synced yet" health placeholders for release, CI, PR, and issues.
- Kept collector flow local-first and token-free.

GH Tracker now positions as:
- Local machine Git stats (available now).
- Remote GitHub health sync (planned next phases).
- Repo pets as a visual maintenance layer driven by real health.

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
