# Data Quality Report — Phase 4A.1

- Largest additions/deletions spike date: `2026-05-20`
- Machine: `nuc1`
- Repo: `openai-plugins`
- Approximate magnitude: `408,807 additions`, `0 deletions` on the largest repo-day row (machine-day aggregate peak ~`414,228` lines changed)

## Evidence
- Aggregate row inspection identified the max repo-day at `nuc1/openai-plugins`.
- Commit inspection for `0d4f5414ed1b1895bc97dbe12b58c83f3c50a47e` shows a very large tracked content addition set.

## Assessment
- This appears to be a real tracked commit event in a large content-heavy repository, not a collector parse error.
- It may still represent low-signal noise for dashboard readability if this repo is not operationally central.

## UI Handling Implemented
- Compact number formatting for large chart values.
- Outlier note displayed on Additions/Deletions chart when extreme daily values are detected.
- Underlying raw data remains unchanged.

## Recommended Phase 4B Follow-up
- Add optional outlier display controls (for example, clearly labeled capped visualization mode while preserving raw values in tooltips/tables).
- Review whether temporary/workspace-heavy repos (like `.tmp` clones) should be filtered at ingestion scope boundaries, without excluding legitimate tracked source repos by default.
