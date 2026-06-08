# Habitat Ops Fixtures Plan

PHASE=OPS-7A_HABITAT_OPS_READONLY_UI_PLAN

For the first implementation pass, prefer checked-in redacted fixtures over direct
runtime CLI execution.

Recommended fixture set:

- `src/lib/harness-ops/__fixtures__/notify-status.txt`
- `src/lib/harness-ops/__fixtures__/notify-dry-run.txt`
- `src/lib/harness-ops/__fixtures__/schedule-inventory.txt`
- `src/lib/harness-ops/__fixtures__/schedule-plan-gh-tracker-local-snapshot-timer.txt`
- `src/lib/harness-ops/__fixtures__/schedule-dry-run-gh-tracker-local-snapshot-timer-disable.txt`
- `src/lib/harness-ops/__fixtures__/schedule-run-once-dry-run-gh-tracker-local-snapshot-timer.txt`
- `src/lib/harness-ops/__fixtures__/tmux-inventory.txt`
- `src/lib/harness-ops/__fixtures__/workspace-plan-gh-tracker.txt`
- `src/lib/harness-ops/__fixtures__/workspace-dry-run-gh-tracker.txt`

Reasons:

- parser contracts become deterministic
- UI rendering tests stay fast
- no runtime shell dependency in the first UI PR
- sample output can be reviewed for redaction before commit

Do not store:

- webhook URLs
- bearer tokens
- env values
- raw session cookies
- anything beyond already-redacted CLI output
