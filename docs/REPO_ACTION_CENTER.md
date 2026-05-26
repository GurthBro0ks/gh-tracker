# Repo Action Center (Phase 6A)

Repo Action Center turns Repo Habitat care actions into read-only operational planning.

## Design Goals

- Show why a canonical repo needs care.
- Preserve machine and location context for each repo.
- Provide copyable safe command text for manual operator use.
- Never execute commands from the browser.

## Safety Model

- Read-only UI only: no git writes, no GitHub writes, no remote execution.
- No in-app actions for commit/push/pull/rebase/stash/reset.
- No issue/PR/release creation and no webhook writes.
- Copyable commands are text only and require operator execution.
- Command templates avoid destructive defaults (`sudo`, `rm -rf`, `git reset --hard`, `git clean -fd`, `git push --force`).

## Auth Requirements

- Basic Auth remains the outer public gate.
- Habitat session remains required for dashboard and protected data routes.
- Unauthenticated sessions must not receive repo path, machine, command, or GitHub health details.

## Action Center Sections

- Overview
- Machines & Locations
- Local Git State
- GitHub Remote Health
- Care Plan
- Copy Commands

## Rollback Notes

If rollback is needed, revert the Phase 6A UI changes and restore previous dashboard/repo-habitat behavior. Do not alter Basic Auth or the existing Habitat session bridge during rollback.
