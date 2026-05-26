# Slimy Auth Bridge

## Overview

GH Tracker (Repo Habitat) uses the existing Slimy owner email/password auth system from `slimy-monorepo`. There is **no second user database** in GH Tracker.

## How It Works

1. User visits Habitat (`https://habitat.slimyai.xyz`)
2. Basic Auth (outer gate) requires credentials
3. If no GH Tracker app session exists, user sees the Habitat login page
4. User submits email + password
5. GH Tracker server forwards credentials to Slimy's `/api/session/login` endpoint
6. Slimy verifies password (argon2) and returns user info including role
7. GH Tracker checks `role === "owner"`
8. On success, GH Tracker creates a short-lived signed JWT cookie (`habitat_session`)
9. Dashboard loads; settings show auth status

## Security

- **No password storage**: GH Tracker never stores passwords or password hashes
- **No second user DB**: Only a signed JWT cookie; no SlimyUser table in GH Tracker
- **Server-to-server only**: Password travels browser → GH Tracker → Slimy API
- **No request body logging**: Login endpoint does not log request bodies
- **httpOnly cookie**: `habitat_session` is httpOnly, secure, SameSite=lax
- **Short-lived**: Default 24-hour TTL (configurable via `HABITAT_SESSION_MAX_AGE_SECONDS`)
- **Owner-only**: Non-owner authenticated users are rejected with 403

## Environment Variables

```bash
# Required: 32+ byte random string for JWT signing
HABITAT_SESSION_SECRET=...

# Optional: session max age in seconds (default 86400 = 24h)
HABITAT_SESSION_MAX_AGE_SECONDS=86400

# Optional: Slimy auth API base URL (default https://slimyai.xyz)
SLIMY_AUTH_BASE_URL=https://slimyai.xyz
```

## Forgot / Reset Password

GH Tracker does **not** implement its own forgot/reset flow. The login page links to:

- `https://slimyai.xyz/auth/forgot-password`

Password reset is handled entirely by the Slimy auth system.

## Basic Auth Remains Active

Caddy Basic Auth on `habitat.slimyai.xyz` remains the outer security gate. The auth bridge is an inner gate. Both must pass to access the dashboard.

- **Do not disable Basic Auth** until manual QA accepts the bridge
- **Do not modify Caddy config** as part of this feature

## Rollback

To remove the auth bridge and restore the pre-bridge state:

1. Revert `src/app/page.tsx` to remove the auth gate
2. Remove auth-related files:
   - `src/lib/auth/session.ts`
   - `src/lib/auth/bridge.ts`
   - `src/app/api/auth/login/route.ts`
   - `src/app/api/auth/logout/route.ts`
   - `src/app/api/auth/me/route.ts`
   - `src/app/login/page.tsx`
   - `src/lib/auth/__tests__/session.test.ts`
3. Remove `HABITAT_SESSION_SECRET` from `.env`
4. Revert `src/components/dashboard.tsx` to remove settings button/panel and session prop
5. Revert version in `src/lib/dashboard-adapter.ts`
6. Restart `gh-tracker.service`

## Files Added / Modified

### New
- `src/lib/auth/session.ts` — JWT cookie creation/verification
- `src/lib/auth/bridge.ts` — Slimy auth API bridge
- `src/app/api/auth/login/route.ts` — login endpoint
- `src/app/api/auth/logout/route.ts` — logout endpoint
- `src/app/api/auth/me/route.ts` — current user endpoint
- `src/app/login/page.tsx` — login page
- `src/lib/auth/__tests__/session.test.ts` — unit tests
- `docs/SLIMY_AUTH_BRIDGE.md` — this file

### Modified
- `src/app/page.tsx` — auth gate (redirect to /login if no session)
- `src/components/dashboard.tsx` — settings button/panel, session prop
- `src/lib/dashboard-adapter.ts` — version bump to 0.5.3-phase5d-auth
- `.env.example` — new env vars documented
