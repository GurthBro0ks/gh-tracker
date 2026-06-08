# Habitat Ops Sanitized Snapshot Adapter Plan

PHASE=OPS-7C_HABITAT_OPS_SANITIZED_SNAPSHOT_ADAPTER_PLAN

## Goal

Replace hardcoded `/ops` fixture data with read-only sanitized JSON snapshot loading.

This phase is planning-only. No adapter is implemented here.

## Non-Goals

- no shell execution in the web app
- no `ops/harness-ops` execution during requests
- no `child_process`, `exec`, `spawn`, `shelljs`, or `execa` in the `/ops` adapter path
- no backend mutation routes
- no live schedule/timer/tmux/notification controls
- no cron/timer/tmux/Caddy/DNS changes as part of web app rendering

## Snapshot Producer Boundary

Recommendation:

- The Habitat web app should only read a pre-sanitized JSON snapshot file.
- Snapshot generation must happen outside the request path.
- Initial producer should be a manual or harness-side command run by an operator or approved maintenance flow.
- A future approved scheduled producer may be added later, but only as a harness-side concern, not a web concern.

Preferred producer progression:

1. Manual operator command or explicit harness proof command.
2. Approved harness-side snapshot export script.
3. Optional later scheduled producer after separate approval.

The web request path must never:

- run `ops/harness-ops`
- read raw shell output and sanitize it on the fly
- invoke system commands directly

## Snapshot Storage Path

Recommendation:

- Canonical live path: `/home/slimy/harness-logs/ops-snapshots/latest.json`
- Optional history directory: `/home/slimy/harness-logs/ops-snapshots/history/`
- Optional metadata sidecar: `/home/slimy/harness-logs/ops-snapshots/latest.meta.json`

Why this path:

- outside the git repo
- consistent with other harness runtime artifacts
- clearly operational rather than app-owned
- easy to rotate, replace, or invalidate without touching app code

The app should treat the snapshot path as read-only input.

Fallback path behavior:

- if the file is absent, the app should stay in fixture mode
- if the file is unreadable or invalid, the app should show a safe error state and not expose raw content

## Snapshot Schema

Recommended top-level schema:

```ts
type OpsSnapshot = {
  schemaVersion: 1;
  mode: "snapshot";
  generatedAt: string;
  source: {
    producer: "manual" | "harness_script" | "approved_schedule";
    machine: "nuc1" | "nuc2" | string;
    repoPath?: string;
    producerVersion?: string;
  };
  freshness: {
    state: "fresh" | "stale" | "missing" | "invalid" | "redaction_failed";
    maxAgeSeconds: number;
    ageSeconds: number | null;
    staleAfter: string | null;
    message: string;
  };
  redaction: {
    status: "passed" | "failed";
    rulesVersion: string;
    redactedFieldCount: number;
    blockedFieldCount: number;
    notes: string[];
  };
  safety: {
    readOnly: true;
    dryRunOnly: true;
    noLiveMutation: true;
    snapshotMode: true;
    backendAdapterConnected: false;
    shellExecutionPresent: false;
  };
  notificationStatus: {
    status: "ok" | "warn" | "error";
    deliveryMode: "disabled" | "runtime" | "relay" | "unknown";
    dedupeState: string;
    reportUrl: string | null;
    redactionNote: string;
  };
  scheduleInventory: {
    summary: {
      userCrontabCount: number;
      systemTimerCount: number;
      readOnlyTargetCount: number;
      notes: string[];
    };
    highlights: Array<{
      label: string;
      value: string;
      risk: "low" | "medium" | "high" | "unknown";
    }>;
  };
  scheduleDryRun: {
    sampleTarget: string;
    planLines: string[];
    enablePreview: string[];
    disablePreview: string[];
    runOncePreview: string[];
  };
  tmuxInventory: {
    summary: {
      sessionCount: number;
      windowCount: number;
      paneCount: number;
    };
    notes: string[];
    highlights: Array<{
      label: string;
      value: string;
    }>;
  };
  workspaceDryRun: {
    canonicalSessionPreview: string;
    previewLines: string[];
    copyOnlyLines: string[];
    notes: string[];
  };
  harnessReports: {
    latest: Array<{
      label: string;
      url: string;
      result: "PASS" | "WARN" | "FAIL" | string;
      generatedAt?: string;
    }>;
    emptyMessage?: string;
  };
};
```

## Sanitization Rules

The producer must remove or replace the following before writing the snapshot:

- webhook URLs
- raw env values
- bearer strings
- tokens
- `.env` contents
- pane scrollback or pane capture
- embedded credentials in URLs
- secret-looking query strings
- secret-looking `KEY=...`, `TOKEN=...`, `PASSWORD=...`, `COOKIE=...`, `SESSION=...` values

Allowed examples:

- boolean presence indicators
- counts
- redacted path labels
- `COPY_ONLY` and `WOULD_RUN` preview text
- sanitized report links

Required producer behavior:

- fail closed if redaction cannot be proven
- mark snapshot `redaction_failed` rather than writing raw content through

## Staleness Rules

Recommended states:

- `fresh`
  - snapshot age is within `maxAgeSeconds`
- `stale`
  - snapshot exists but is older than `maxAgeSeconds`
- `missing`
  - snapshot file does not exist
- `invalid`
  - snapshot exists but JSON parse or schema validation fails
- `redaction_failed`
  - producer detected unredacted or blocked content

Recommended defaults:

- `maxAgeSeconds = 900` for operator confidence
- `fresh`: <= 15 minutes old
- `stale`: > 15 minutes old but file is readable

## UI Behavior

When adapter implementation begins later:

- preserve `READ ONLY`
- preserve `DRY RUN ONLY`
- preserve `NO LIVE MUTATION`
- add `SNAPSHOT MODE` when the adapter is active
- keep `FIXTURE ONLY` visible only while fallback fixtures are actually in use

State handling:

- `fresh`
  - render snapshot data normally
- `stale`
  - render sanitized data with a visible staleness warning card
- `missing`
  - show fixture fallback with explicit `FIXTURE ONLY` label and a note that no snapshot is available
- `invalid`
  - render a safe error card and do not show raw snapshot content
- `redaction_failed`
  - render a high-safety error card and do not show raw snapshot content

Mobile behavior requirements carried forward:

- long snapshot strings must wrap or scroll inside their own block
- card grid must remain mobile-safe
- no page-level horizontal overflow

## Adapter Shape For Later OPS-7D

Recommended implementation boundary:

- `src/lib/harness-ops-snapshot.ts`
  - file-read only
  - no command execution
  - validates and parses JSON
- `src/lib/harness-ops-snapshot-schema.ts`
  - schema types and validation helpers
- `src/app/ops/page.tsx`
  - owner-gated server component
  - reads validated snapshot or falls back to fixtures

Recommended runtime logic:

1. owner auth check
2. attempt read of sanitized snapshot file
3. validate JSON and schema
4. derive freshness state
5. render snapshot mode or safe fallback mode

## Test Plan Summary

OPS-7D should include tests for:

- valid snapshot render
- missing snapshot fallback to fixtures
- stale snapshot warning render
- invalid snapshot safe failure render
- redaction-failed snapshot safe failure render
- no shell execution imports in snapshot adapter path
- no live action buttons exist
- mobile overflow remains fixed
- owner gate still applies to `/ops`

## Recommended Next Step

Implement OPS-7D as a read-only snapshot adapter that reads sanitized JSON only,
never executes live commands, and falls back safely to fixtures when the snapshot
is missing or invalid.
