# GH Tracker Project Plan

## Goal
Build a local browser dashboard that tracks Git and GitHub activity across Laptop, NUC1, and NUC2 with machine-level and combined analytics.

## Phase 0 Scope
- Standalone Next.js + TypeScript + Tailwind scaffold
- Demo dataset and explicit data model boundaries
- Dashboard shell with metrics, filters, charts, timeline, and debug dock
- No collectors, no secrets, no GitHub API integration

## Immediate Next Work
1. Define local collector contracts and file ingestion format
2. Build machine-side collectors for repo status snapshots
3. Merge collector outputs into normalized event stream
4. Add persistence and refresh workflows
