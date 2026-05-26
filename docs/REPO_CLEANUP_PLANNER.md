# Repo Cleanup Planner (Phase 6C)

Repo Cleanup Planner ranks canonical repositories by cleanup urgency using read-only local snapshot + GitHub health data already present in Repo Habitat.

## Safety Model

- Read-only planning UI only.
- No command execution from the browser.
- No git write actions (`commit`, `push`, `pull`, `rebase`, `stash`, `reset`) are executed by the app.
- No GitHub write actions (issues/PRs/releases/webhooks).
- Copyable commands are text only and require manual operator execution.

## Scoring Model

Deterministic score rules (higher = more urgent):

- +50 dirty and unpushed
- +35 unpushed commits > 10
- +25 unpushed commits > 0
- +25 dirty on multiple locations
- +20 mixed state across machines
- +15 dirty
- +15 open PRs
- +10 open issues
- +10 no CI runs found
- +10 no release found
- +5 maintenance momentum low

Priority bands:

- `critical`: score >= 80
- `high`: score >= 55
- `medium`: score >= 30
- `low`: score >= 10
- `info`: score < 10

## Planner Output

Each ranked repo includes:

- priority score and band
- reasons for ranking
- recommended manual action categories
- affected machines and locations
- copy-only safe inspection command groups

## Copy-Only Command Rules

Allowed defaults include:

- `ssh nuc1` / `ssh nuc2`
- `cd <repo_path>`
- `git status --branch --short`
- `git diff --stat`
- `git log --oneline -5`
- `git branch --show-current`
- `git remote -v`

Dangerous commands are intentionally excluded by default (`sudo`, `rm -rf`, `git reset --hard`, `git clean -fd`, `git push --force`).

## Auth Requirements

- Basic Auth remains the outer public gate.
- Habitat session remains required for dashboard and protected API data.
- Unauthenticated requests do not receive planner or action-center sensitive repo details.

## Rollback Notes

If rollback is required, remove Phase 6C planner rendering and scoring logic while keeping Phase 6A/6B Action Center and heatmap inspector behavior intact.
