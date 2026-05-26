# Auth QA Checklist

## Gate order
- Public `https://habitat.slimyai.xyz` prompts Basic Auth first.
- After Basic Auth, Habitat login page appears.

## Login and settings
- Owner email/password login succeeds (manual browser QA only).
- Settings modal opens cleanly.
- Settings shows app version `0.5.4-phase5e-auth-hardening`.
- Settings shows auth source: Slimy owner email/password.
- Settings shows signed-in owner identity and role.
- Settings shows outer gate status: Basic Auth still enabled.
- Settings shows GitHub sync status.

## Logout and refresh
- Sign Out clears app session.
- After logout, refresh stays on login/auth-required state.
- Dashboard data does not render until a new valid login.

## Route/API protection
- Unauthenticated `/` redirects to `/login` or otherwise blocks dashboard data.
- `/login` remains accessible without app session.
- Protected API/data routes reject unauthenticated access (401/403 or safe auth-required response).

## Password reset path
- Forgot password link targets Slimy auth flow (`https://slimyai.xyz/auth/forgot-password`).
- No fake local reset flow exists in GH Tracker.

## Safety checks
- No passwords in logs, test output, or proof artifacts.
- No cookie values or auth tokens in logs/proofs.
- No password hashes or secret values exposed.
