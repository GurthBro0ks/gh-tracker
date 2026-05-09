# Harness Rules

## Required Discipline
- Maintain proof packs for each phase operation
- Stop immediately on critical failures
- Capture git state before and after changes
- Capture diffs, build logs, route checks, and forbidden-file checks

## Forbidden Touch Zones
- `/opt/slimy/slimy-monorepo/**`
- `apps/web/**`, `apps/bot/**`, `club/**`, `OCR/**`, `snail/personal/**`
- `trader/**`, `crypto/**`, `/etc/**`, systemd unit files, Caddyfile
- `.env` and token-bearing files

## Validation Gates
- install deps
- lint/format (if configured)
- typecheck (if configured)
- build
- local route check on non-conflicting port
