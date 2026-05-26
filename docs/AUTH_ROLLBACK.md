# Auth Rollback Guide

## Current auth bridge
- Habitat app auth uses Slimy owner email/password via server-side bridge (`/api/auth/login`).
- Successful owner auth creates a signed `habitat_session` cookie; dashboard and protected routes require it.
- Role enforcement is owner-only.

## Outer gate stays in place
- Public access remains behind Caddy Basic Auth.
- App-level session auth is an inner gate and does not replace Basic Auth.

## Roll back app-session gate
- Revert the Phase 5D and Phase 5E auth commits in GH Tracker (do not edit Slimy monorepo auth).
- Keep Basic Auth unchanged.
- Rebuild and restart the GH Tracker service after revert.

## Restart service
```bash
systemctl --user restart gh-tracker.service
systemctl --user status gh-tracker.service --no-pager
```

## Verification after rollback or forward deploy
```bash
curl -I https://habitat.slimyai.xyz
curl -i http://127.0.0.1:5055/
curl -i http://127.0.0.1:5055/login
curl -i http://127.0.0.1:5055/api/auth/me
```

- Public endpoint must still return HTTP 401 Basic Auth challenge.
- Local dashboard behavior must match intended auth posture for the deployed revision.
- Never log or include passwords, hashes, cookie values, or auth tokens in proof artifacts.
