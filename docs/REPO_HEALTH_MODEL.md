# Repo Health Model

`RepoHealth` blends local maintenance quality and future remote health signals.

Current score bands:
- 90-100: legendary
- 75-89: healthy
- 55-74: needs care
- 35-54: stressed
- 0-34: sick

Current local contributors:
- Local cleanliness score (dirty/staged/unstaged/untracked).
- Sync score (ahead/behind from local git state).
- Activity momentum score (recent commit cadence).

Phase 2 placeholders (not synced yet):
- Release freshness and commits since release.
- CI health.
- PR pressure.
- Issue pressure.

Outputs:
- Attention reasons list for user-facing diagnostics.
- Recommended care actions list for practical maintenance.
