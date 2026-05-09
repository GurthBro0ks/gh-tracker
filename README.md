# gh-tracker

Local dashboard for tracking Git/GitHub activity across Laptop, NUC1, and NUC2.

## Phase 0
- Next.js + TypeScript + Tailwind + Recharts scaffold
- Demo data only
- No collectors, no GitHub token usage, no webhooks

## Run Local
```bash
pnpm install
pnpm dev --port 5055
```

Open `http://127.0.0.1:5055`.

## Validate
```bash
pnpm lint
pnpm typecheck
pnpm build
```

## Docs
- `docs/PROJECT_PLAN.md`
- `docs/PHASES.md`
- `docs/DATA_MODEL.md`
- `docs/COLLECTOR_PLAN.md`
- `docs/VISUAL_STYLE.md`
- `docs/HARNESS_RULES.md`
