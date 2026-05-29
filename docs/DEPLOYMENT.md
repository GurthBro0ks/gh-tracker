# Deployment

## Repo Habitat Gated Standalone

Target route:
- `https://habitat.slimyai.xyz`

Runtime model:
- GH Tracker remains a standalone app in `/opt/slimy/gh-tracker`.
- App is served by user service `gh-tracker.service`.
- Service binds to `127.0.0.1:5055` only.

Gate model:
- Caddy Basic Auth protects all habitat routes.
- Reverse proxy target is `127.0.0.1:5055`.
- Basic Auth password is host-local operator secret and is not committed to repo.

Collector model:
- Collector remains local-only.
- No cron/timer/webhook changes in this phase.

Integration policy:
- Command Center integration is intentionally deferred until gated route is externally verified.
