# Habitat Ops Read-Only UI Plan

PHASE=OPS-7A_HABITAT_OPS_READONLY_UI_PLAN

## Scope

Plan a read-only Habitat `/ops` surface on top of accepted `ops/harness-ops`
CLI commands.

This phase does not add:

- live schedule enable/disable
- live run-once
- tmux create/reuse
- backend mutation routes
- UI buttons that imply live mutation exists

## Habitat Repo And Routing

- Habitat repo: `/opt/slimy/gh-tracker`
- App router root: `src/app/`
- Authenticated owner-gated dashboard entry: `src/app/page.tsx`
- Existing read-only Habitat subsection precedent: `src/app/research/page.tsx`
- Existing detail-route precedent: `src/app/research/runs/[runId]/page.tsx`
- Root nav button precedent: `src/components/dashboard.tsx`

Current route shape relevant to `/ops`:

- `/` dashboard, owner-gated, renders `Dashboard`
- `/research` owner-gated read-only section with cards/stats/detail links
- `/research/runs/[runId]` owner-gated detail page
- `/api/research/*` owner-gated backend adapters for read-only/protected research data

## Where `/ops` Should Live

Recommended route placement:

- Page route: `src/app/ops/page.tsx`
- Optional future detail routes:
  - `src/app/ops/schedules/[scheduleId]/page.tsx`
  - `src/app/ops/workspaces/[workspaceId]/page.tsx`

Why here:

- It matches the existing Habitat pattern of top-level owner-gated sections.
- `src/app/page.tsx` already enforces session + owner checks before rendering.
- `src/app/research/page.tsx` is the closest UI precedent for a read-only operational
  section with summary cards and drill-down links.
- The dashboard header already exposes section links (`/research`), so `/ops` can be
  added beside that without inventing a second app shell.

Recommended navigation label:

- `Harness Ops`

Recommended route policy:

- owner-gated only
- `export const dynamic = "force-dynamic"`
- server-rendered summary page first
- no query-param driven mutation semantics

## CLI Surface Mapping

Accepted upstream surfaces:

- `notify status`
- `notify dry-run`
- `notify dedupe-check`
- `schedule inventory`
- `schedule validate`
- `schedule plan`
- `schedule dry-run`
- `schedule run-once-dry-run`
- `schedule controls-validate`
- `tmux inventory`
- `tmux validate`
- `workspace plan`
- `workspace dry-run`
- `workspace validate`

Observed output styles:

- command status blocks ending in `RESULT=PASS|WARN|OK`
- top-level metadata header lines
- repeated `---` entry blocks for inventory surfaces
- explicit `COPY_ONLY:` lines for non-executable guidance
- explicit `WOULD_RUN:` lines for future action previews

## Proposed Read-Only Data Model

All adapter output should normalize CLI text into stable TypeScript objects inside
Habitat. The UI should never parse shell text directly inside React components.

### 1. Notification Status

```ts
type OpsNotifyStatus = {
  kind: "notify_status";
  generatedAt: string;
  result: "PASS" | "WARN" | "FAIL";
  warnings: number;
  reportUrlBase: string;
  sessionReportUrlPattern: string;
  mentionTargetIdPresent: boolean;
  channels: Array<{
    name: string;
    type: string;
    scriptPath: string;
    scriptPresent: boolean;
    legacyCleanupNeeded?: boolean;
  }>;
  envKeys: {
    nuc1Required: Array<{ key: string; present: boolean }>;
    nuc1Optional: Array<{ key: string; present: boolean }>;
    nuc2Expected: Array<{ key: string; present: boolean }>;
    nuc2MustNotStore: Array<{ key: string; absent: boolean }>;
  };
  markerState: {
    stateDirPresent: boolean;
    markerCount: number;
  };
  machineOwnership: {
    nuc1OwnsWebhookEnv: boolean;
    nuc1OwnsCompletionSend: boolean;
    nuc2UsesRelayPath: boolean;
    nuc2StoresWebhookUrl: boolean;
  };
};
```

### 2. Notification Dry-Run Preview

```ts
type OpsNotifyDryRun = {
  kind: "notify_dry_run";
  title: string;
  result: "PASS" | "WARN" | "FAIL";
  repo: string;
  commit: string;
  task: string;
  nuc: string;
  host: string;
  proofPath: string;
  reportUrl: string;
  mentionSuppressed: boolean;
  markdownLines: string[];
  safetyLabel: "DRY RUN";
};
```

### 3. Notification Dedupe Check

```ts
type OpsDedupeCheck = {
  kind: "notify_dedupe_check";
  input: string;
  stateDir: string;
  sentMarkers: Array<{ key: string; timestamp: string }>;
  relaySentCount: number;
  relayFailedCount: number;
  inputMatches: number;
  result: "OK" | "WARN" | "FAIL";
};
```

UI note: do not render full marker filenames by default. Show counts first and allow
owner-only expansion if needed.

### 4. Schedule Inventory

```ts
type OpsScheduleInventoryEntry = {
  machine: string;
  scheduleType: string;
  owner: string;
  source: string;
  unitOrJob: string;
  commandSummary: string;
  nextRun: string | null;
  lastRun: string | null;
  state: string;
  projectGuess: string;
  risk: "low" | "medium" | "high" | "unknown";
  notes: string;
};

type OpsScheduleInventory = {
  kind: "schedule_inventory";
  generatedAt: string;
  machine: string;
  mode: "read-only";
  redaction: "enabled";
  entries: OpsScheduleInventoryEntry[];
  result: "PASS" | "WARN" | "FAIL";
  warnings?: number;
};
```

Derived UI aggregates:

- counts by `scheduleType`
- counts by `risk`
- counts by `machine`
- `gh-tracker`-related timers/jobs highlighted separately

### 5. Schedule Plan

```ts
type OpsSchedulePlan = {
  kind: "schedule_plan";
  scheduleId: string;
  description: string;
  targetMachine: string;
  ownerScope: "user" | "system" | string;
  sourceType: string;
  sourcePathOrUnit: string;
  managedMode: "managed_candidate" | "read_only" | string;
  riskLevel: "low" | "medium" | "high" | "unknown";
  approvalLevel: string;
  liveEnableAllowed: false;
  liveDisableAllowed: false;
  liveRunOnceAllowed: false;
  futureSafeguards: string[];
  notes: string;
  result: "PASS" | "WARN" | "FAIL";
};
```

### 6. Schedule Dry-Run Preview

```ts
type OpsScheduleDryRun = {
  kind: "schedule_dry_run";
  scheduleId: string;
  action: "enable" | "disable";
  targetMachine: string;
  ownerScope: string;
  scheduleType: string;
  managedMode: string;
  riskLevel: "low" | "medium" | "high" | "unknown";
  futureRequiredFlags: string[];
  previewCommands: string[]; // parsed from WOULD_RUN
  copyOnlyChecks: string[];  // parsed from COPY_ONLY
  notes: string;
  result: "PASS" | "WARN" | "FAIL";
};
```

### 7. Schedule Run-Once Dry-Run Preview

```ts
type OpsScheduleRunOnceDryRun = {
  kind: "schedule_run_once_dry_run";
  scheduleId: string;
  targetMachine: string;
  ownerScope: string;
  scheduleType: string;
  riskLevel: "low" | "medium" | "high" | "unknown";
  futureRequiredFlags: string[];
  previewCommands: string[];
  copyOnlyChecks: string[];
  notes: string;
  result: "PASS" | "WARN" | "FAIL";
};
```

### 8. Tmux Inventory

```ts
type OpsTmuxPane = {
  machine: string;
  tmuxServerStatus: string;
  owner: string;
  sessionName: string;
  sessionCreated: string;
  sessionWindows: number;
  sessionAttached: string;
  windowIndex: string;
  windowName: string;
  windowActive: string;
  paneIndex: string;
  paneId: string;
  paneActive: string;
  paneCurrentCommand: string;
  paneCurrentPath: string;
  paneWidth: number | null;
  paneHeight: number | null;
  projectGuess: string;
  risk: "low" | "medium" | "high" | "unknown";
  notes: string;
};

type OpsTmuxInventory = {
  kind: "tmux_inventory";
  generatedAt: string;
  machine: string;
  mode: "read-only";
  paneContentCapture: "disabled_by_default";
  notes: string;
  panes: OpsTmuxPane[];
  result: "PASS" | "WARN" | "FAIL";
  warnings: number;
};
```

Derived UI aggregates:

- sessions by machine
- attached vs detached counts
- project guess histogram
- `gh-tracker` / `slimy-harness` / `agent-workflow` quick filters

### 9. Workspace Plan

```ts
type OpsWorkspacePlan = {
  kind: "workspace_plan";
  workspaceId: string;
  canonicalSessionName: string;
  targetMachine: string;
  defaultBehavior: string;
  liveCreateAllowed: false;
  liveReuseAllowed: false;
  risk: "low" | "medium" | "high" | "unknown";
  notes: string;
  targetPaths: string[];
  windows: Array<{ name: string; dir: string }>;
  copyOnlyCommands: string[];
  result: "PASS" | "WARN" | "FAIL";
};
```

### 10. Workspace Dry-Run Preview

```ts
type OpsWorkspaceDryRun = {
  kind: "workspace_dry_run";
  workspaceId: string;
  canonicalSessionName: string;
  targetMachine: string;
  noncanonicalConflictSessionName?: string;
  previewCommands: string[];
  copyOnlyCommands: string[];
  result: "PASS" | "WARN" | "FAIL";
};
```

### 11. Validation Summary

```ts
type OpsValidationSummary = {
  kind: "validation_summary";
  scheduleValidate: { result: string; warnings: number };
  scheduleControlsValidate?: { result: string; warnings: number };
  tmuxValidate: { result: string; warnings: number };
  workspaceValidate: { result: string; warnings: number };
};
```

### 12. Latest Harness Reports

This should not shell out to a live notification sender. The Habitat side should read
pre-existing report files or URLs only.

```ts
type OpsHarnessReportLink = {
  label: string;
  reportUrl: string;
  source: "report_dir" | "session_report_json" | "proof_result";
  createdAt?: string;
  result?: "PASS" | "FAIL" | "PARTIAL_PASS" | string;
};
```

## Backend Adapter Boundaries

Recommended adapter split:

- `src/lib/harness-ops/contracts.ts`
  - shared TypeScript types only
- `src/lib/harness-ops/parser.ts`
  - converts read-only CLI text into typed objects
- `src/lib/harness-ops/runtime.ts`
  - single place allowed to run read-only `ops/harness-ops` commands
- `src/lib/harness-ops/reports.ts`
  - reads latest proof/report metadata only
- `src/app/api/ops/*`
  - optional read-only route handlers if client refresh becomes necessary

Initial recommendation:

- Start without client-side polling or mutation routes.
- Load data server-side in `src/app/ops/page.tsx`.
- Use route handlers only if the page later needs partial refresh or filter-driven
  background fetches.

Runtime boundary rules:

- allowlist exact commands only
- no arbitrary shell input from query params
- no pass-through user command text
- no `POST` mutation endpoints
- no adapter for any hypothetical future live commands
- parser must reject unexpected output shape with visible read-only error state

Recommended command allowlist for the first pass:

- `ops/harness-ops notify status`
- `ops/harness-ops notify dry-run`
- `ops/harness-ops schedule inventory`
- `ops/harness-ops schedule controls-validate`
- `ops/harness-ops tmux inventory`
- `ops/harness-ops tmux validate`
- `ops/harness-ops workspace plan gh-tracker`
- `ops/harness-ops workspace dry-run gh-tracker`

Why not every command on day one:

- `schedule dry-run` and `run-once-dry-run` are better as static preview cards for a
  small allowlisted set of schedule IDs, not arbitrary freeform selection.
- `notify dedupe-check` should be secondary because it accepts input and adds more UI
  complexity around marker inspection.

## Proposed UI Sections

Recommended page title:

- `Harness Ops Burrow`

Required top-level safety labels, always visible above the fold:

- `READ ONLY`
- `DRY RUN ONLY`
- `NO LIVE MUTATION`

Recommended card layout order:

1. Safety Banner
   - three required labels
   - one sentence: `This Habitat surface mirrors accepted Harness Ops CLI output and never performs live schedule, timer, tmux, or Discord actions.`
2. Notification Status
   - channel count, env presence summary, marker dir health
   - link to latest report cards
3. Schedule Inventory Summary
   - totals by machine, type, risk, and `gh-tracker`-related timers
   - table of top relevant entries only by default
4. Schedule Control Dry-Run Previews
   - `gh-tracker-local-snapshot-timer`
   - `gh-tracker-github-health-sync-timer`
   - `nuc1-daily-report-timer`
   - preview text must display `WOULD_RUN` and `COPY_ONLY` chips
5. Tmux Inventory Summary
   - session count, attached/detached, local vs remote, project-guess buckets
   - no pane capture and no key-send controls
6. Workspace Dry-Run Plans
   - start with `gh-tracker` workspace
   - optional tabs for `harness`, `research-farm`, `diagnostics`
7. Latest Harness Reports
   - latest report links with result badge and source
8. Validation Status
   - `schedule controls-validate`, `tmux validate`, `workspace validate`

Recommended cards to defer:

- freeform dedupe marker search
- arbitrary schedule selection
- arbitrary workspace selection
- raw terminal log viewer

## Route And Component Sketch

Minimal page structure for a future implementation:

```txt
src/app/ops/page.tsx
src/components/harness-ops/ops-page.tsx
src/components/harness-ops/ops-safety-banner.tsx
src/components/harness-ops/notify-status-card.tsx
src/components/harness-ops/schedule-summary-card.tsx
src/components/harness-ops/schedule-preview-card.tsx
src/components/harness-ops/tmux-summary-card.tsx
src/components/harness-ops/workspace-preview-card.tsx
src/components/harness-ops/report-links-card.tsx
src/lib/harness-ops/contracts.ts
src/lib/harness-ops/parser.ts
src/lib/harness-ops/runtime.ts
```

Implementation style should follow existing Research Farm page conventions:

- owner gate at the page level
- server-rendered summaries
- small presentational cards
- explicit empty/error states
- zero mutation affordances

## Validation And Test Plan

If the next phase adds code, validate with:

- `git status --short`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm build`

Recommended test matrix:

1. Static parser tests
   - parse notify status sample
   - parse schedule inventory header and entries
   - parse `WOULD_RUN` / `COPY_ONLY` previews
   - reject malformed or partial output safely
2. Read-only page rendering tests
   - `/ops` renders required safety labels
   - notification/schedule/tmux/workspace sections render with mock adapter data
   - empty-state rendering works if a command returns WARN or no entries
3. Forbidden-action absence tests
   - assert `/ops` source contains no button text for `Enable`, `Disable`, `Run now`, `Create workspace`, `Reuse session`, `Send Discord`
   - assert no mutation HTTP verbs/routes exist under `src/app/api/ops`
4. Boundary tests
   - runtime allowlist refuses unknown command names
   - parser strips or ignores unexpected secret-like text if encountered
5. Regression tests
   - `/` dashboard still renders
   - `/research` still renders
   - owner auth redirects still hold for unauthenticated access

Suggested test files:

- `src/lib/__tests__/harness-ops-parser.test.ts`
- `src/lib/__tests__/harness-ops-runtime.test.ts`
- `src/lib/__tests__/harness-ops-page-static.test.ts`

Suggested forbidden-string scan for implementation PRs:

```bash
rg -n "Enable|Disable|Run now|Run once|Create workspace|Reuse session|Send Discord|POST /api/ops|systemctl --user (start|stop|enable|disable)|tmux (new-session|kill-session|attach|send-keys)" src
```

## Safety Summary

- Keep Habitat `/ops` owner-gated.
- Use only allowlisted, read-only `ops/harness-ops` commands.
- Render `WOULD_RUN` and `COPY_ONLY` literally as preview state, never as buttons.
- Prefer summary cards over raw command text dumps.
- Do not expose freeform shell input in the UI.
- Do not add schedule/tmux mutation endpoints.
- Do not add any UI copy that suggests mutation exists today.

## Recommended Next Action

Implement a minimal owner-gated `src/app/ops/page.tsx` that uses mocked adapter data
or checked-in sample fixtures first, plus parser tests and forbidden-action absence
tests, before wiring live read-only CLI execution.
