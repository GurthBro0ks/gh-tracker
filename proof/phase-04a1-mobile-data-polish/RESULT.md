# Phase 4A.1 — Mobile Layout + Data Quality Polish

Status: PASS (with recovery)

## Mobile Layout Changes
- Repo Habitat cards now avoid mobile overflow via wrap-safe title/labels, stacked badge/layout behavior on narrow screens, and break-word handling for attention/actions/chips.
- Habitat Quick View retains horizontal scroll, shows intentional partial-next-card affordance, and uses snap/start + scroll padding.
- Repo Locations now render mobile cards below `sm` while preserving the desktop table at and above `sm`.
- Bottom safe-area padding increased to avoid Safari bottom-bar overlap on final content.

## Data Quality Findings
- Largest spike observed on `2026-05-20` from machine `nuc1`, repo `openai-plugins`.
- Approximate spike magnitude: `408,807 additions` (deletions near zero for the repo-day row).
- Commit evidence points to a large tracked-content change in that repo rather than collector corruption.
- UI handling added: compact number formatting for large chart values and explicit outlier note when extreme line-change days are detected.

## Validation
- Lint: pass
- Typecheck: pass
- Build: pass
- `collect:local`: pass
- `validate:snapshot`: pass
- `aggregate:snapshots`: pass
- `validate:aggregate`: pass (`repo_locations=42`, `machines=2`)

## Service and Routing
- `gh-tracker.service` verified binding on `127.0.0.1:5055`.
- A transient local probe failure occurred immediately after one restart; subsequent probes succeeded and listener ownership was confirmed.

## Known Limitations
- Outlier handling is UI-only (labeling/formatting); underlying data remains unmodified.

## Next Recommendation
- Phase 4B: add conservative exclusion policy review and optional chart-domain outlier controls with clear labeling, then add laptop ingestion.
