import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession, requireOwner } from "@/lib/auth/session";
import { loadHabitatOpsSnapshot } from "@/lib/harness-ops-snapshot";
import type {
  OpsPreviewResult,
  ScheduleDryRunTarget,
  TmuxSessionMetadata,
  WorkspaceDryRunTarget,
} from "@/lib/harness-ops-fixtures";

export const dynamic = "force-dynamic";

function SafetyBadge({ label }: { label: string }) {
  return (
    <span className="max-w-full rounded border border-amber-300/40 bg-amber-400/10 px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-amber-200 break-words [overflow-wrap:anywhere]">
      {label}
    </span>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="neon-panel min-w-0 overflow-hidden rounded-xl p-4">
      <h2 className="font-sans text-sm uppercase tracking-[0.12em] text-fuchsia-200 break-words [overflow-wrap:anywhere]">{title}</h2>
      <div className="mt-3 min-w-0 space-y-3 text-sm text-violet-100/90 [&_p]:break-words [&_p]:[overflow-wrap:anywhere] [&_span]:max-w-full [&_span]:[overflow-wrap:anywhere]">
        {children}
      </div>
    </section>
  );
}

function FixtureList({ lines }: { lines: Array<{ label: string; value: string }> }) {
  return (
    <dl className="min-w-0 space-y-2 text-sm">
      {lines.map((line) => (
        <div key={line.label} className="min-w-0 rounded-lg border border-white/10 bg-black/20 px-3 py-2">
          <dt className="text-[10px] uppercase tracking-[0.12em] text-violet-300/75 break-words [overflow-wrap:anywhere]">{line.label}</dt>
          <dd className="mt-1 min-w-0 text-violet-100 break-words [overflow-wrap:anywhere]">{line.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function PreviewBlock({ lines }: { lines: string[] }) {
  return (
    <div className="max-w-full min-w-0 overflow-x-auto rounded-lg border border-cyan-300/20 bg-black/25 p-3 font-mono text-xs text-cyan-100 whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
      {lines.map((line) => (
        <div key={line} className="min-w-0 whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
          {line}
        </div>
      ))}
    </div>
  );
}

const resultStyles: Record<OpsPreviewResult, string> = {
  PASS: "border-lime-300/40 bg-lime-400/10 text-lime-200",
  WARN: "border-amber-300/40 bg-amber-400/10 text-amber-200",
  REFUSED: "border-orange-300/40 bg-orange-400/10 text-orange-200",
  FAIL: "border-rose-300/40 bg-rose-400/10 text-rose-200",
  UNKNOWN: "border-violet-300/40 bg-violet-400/10 text-violet-200",
  NOT_RUN: "border-slate-300/40 bg-slate-400/10 text-slate-200",
};

function ResultBadge({ result }: { result: OpsPreviewResult }) {
  return (
    <span className={`rounded border px-2 py-0.5 text-[10px] font-semibold tracking-[0.08em] ${resultStyles[result]}`}>
      {result}
    </span>
  );
}

function MetadataValue({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0 rounded border border-white/10 bg-black/20 px-2.5 py-2">
      <dt className="text-[10px] uppercase tracking-[0.1em] text-violet-300/75">{label}</dt>
      <dd className="mt-1 min-w-0 break-words text-violet-100 [overflow-wrap:anywhere]">{value}</dd>
    </div>
  );
}

function PreviewDetails({
  label,
  result,
  lines,
}: {
  label: string;
  result: OpsPreviewResult;
  lines: string[];
}) {
  return (
    <details className="group min-w-0 overflow-hidden rounded-lg border border-white/10 bg-black/15">
      <summary className="flex min-w-0 cursor-pointer list-none flex-wrap items-center justify-between gap-2 px-3 py-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300">
        <span className="break-words text-xs font-semibold uppercase tracking-[0.1em] text-violet-200 [overflow-wrap:anywhere]">{label}</span>
        <ResultBadge result={result} />
      </summary>
      <div className="min-w-0 border-t border-white/10 p-2">
        {lines.length > 0 ? <PreviewBlock lines={lines} /> : <p className="text-violet-300/75">No preview lines reported.</p>}
      </div>
    </details>
  );
}

function ScheduleTargets({ targets }: { targets: ScheduleDryRunTarget[] }) {
  return (
    <div className="min-w-0 space-y-2">
      <p>Total schedule targets: {targets.length}</p>
      {targets.map((target, index) => (
        <details key={`${target.scheduleId}-${index}`} className="group min-w-0 overflow-hidden rounded-lg border border-fuchsia-300/20 bg-black/20">
          <summary className="flex min-w-0 cursor-pointer list-none flex-wrap items-center justify-between gap-2 px-3 py-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300">
            <span className="min-w-0 break-words font-mono text-sm text-lime-300 [overflow-wrap:anywhere]">{target.scheduleId}</span>
            <ResultBadge result={target.planResult} />
          </summary>
          <div className="min-w-0 space-y-3 border-t border-white/10 p-3">
            <dl className="grid min-w-0 gap-2 sm:grid-cols-2">
              <MetadataValue label="Target machine" value={target.targetMachine} />
              <MetadataValue label="Risk" value={target.risk} />
              <MetadataValue label="Managed mode" value={target.managedMode} />
              <MetadataValue label="Live enable allowed" value={target.liveEnableAllowed ? "yes" : "no"} />
              <MetadataValue label="Live disable allowed" value={target.liveDisableAllowed ? "yes" : "no"} />
              <MetadataValue label="Live run-once allowed" value={target.liveRunOnceAllowed ? "yes" : "no"} />
            </dl>
            <PreviewDetails label="Plan Preview" result={target.planResult} lines={target.planLines} />
            <PreviewDetails label="Enable Preview" result={target.enableResult} lines={target.enablePreview} />
            <PreviewDetails label="Disable Preview" result={target.disableResult} lines={target.disablePreview} />
            <PreviewDetails label="Run-Once Preview" result={target.runOnceResult} lines={target.runOncePreview} />
            <div>
              <p className="mb-1 text-[10px] uppercase tracking-[0.1em] text-violet-300/75">Notes</p>
              {target.notes.length > 0 ? (
                <ul className="space-y-1">
                  {target.notes.map((note, noteIndex) => <li key={noteIndex} className="break-words [overflow-wrap:anywhere]">{note}</li>)}
                </ul>
              ) : <p className="text-violet-300/75">No notes reported.</p>}
            </div>
          </div>
        </details>
      ))}
    </div>
  );
}

function WorkspaceTargets({ targets }: { targets: WorkspaceDryRunTarget[] }) {
  return (
    <div className="min-w-0 space-y-2">
      <p>Total workspace targets: {targets.length}</p>
      {targets.map((target, index) => (
        <details key={`${target.workspaceId}-${index}`} className="group min-w-0 overflow-hidden rounded-lg border border-fuchsia-300/20 bg-black/20">
          <summary className="flex min-w-0 cursor-pointer list-none flex-wrap items-center justify-between gap-2 px-3 py-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300">
            <span className="min-w-0 break-words font-mono text-sm text-lime-300 [overflow-wrap:anywhere]">{target.workspaceId}</span>
            <ResultBadge result={target.planResult} />
          </summary>
          <div className="min-w-0 space-y-3 border-t border-white/10 p-3">
            <dl className="grid min-w-0 gap-2 sm:grid-cols-2">
              <MetadataValue label="Target machine" value={target.targetMachine} />
              <MetadataValue label="Canonical session preview" value={target.canonicalSessionPreview} />
            </dl>
            <PreviewDetails label="Plan Result" result={target.planResult} lines={target.previewLines} />
            <div>
              <p className="mb-2 text-[10px] uppercase tracking-[0.14em] text-violet-300/75">Copy-Only Guidance</p>
              {target.copyOnlyLines.length > 0 ? <PreviewBlock lines={target.copyOnlyLines} /> : <p className="text-violet-300/75">No copy-only lines reported.</p>}
            </div>
            <div>
              <p className="mb-1 text-[10px] uppercase tracking-[0.1em] text-violet-300/75">Notes</p>
              {target.notes.length > 0 ? (
                <ul className="space-y-1">
                  {target.notes.map((note, noteIndex) => <li key={noteIndex} className="break-words [overflow-wrap:anywhere]">{note}</li>)}
                </ul>
              ) : <p className="text-violet-300/75">No notes reported.</p>}
            </div>
          </div>
        </details>
      ))}
    </div>
  );
}

function TmuxSessions({ sessions }: { sessions: TmuxSessionMetadata[] }) {
  return (
    <div className="min-w-0 space-y-2">
      <p>Total structured sessions: {sessions.length}</p>
      {sessions.length === 0 && <p className="text-violet-300/75">No structured tmux sessions reported.</p>}
      {sessions.map((session, index) => (
        <details key={`${session.machine}-${session.sessionName}-${index}`} className="group min-w-0 overflow-hidden rounded-lg border border-fuchsia-300/20 bg-black/20">
          <summary className="flex min-w-0 cursor-pointer list-none flex-wrap items-center justify-between gap-2 px-3 py-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300">
            <span className="min-w-0 break-words font-mono text-sm text-lime-300 [overflow-wrap:anywhere]">{session.sessionName}</span>
            <span className="flex flex-wrap gap-2">
              <SafetyBadge label={session.canonical ? "CANONICAL" : "NONCANONICAL"} />
              <SafetyBadge label={session.attached === null ? "ATTACHMENT UNKNOWN" : session.attached ? "ATTACHED" : "DETACHED"} />
            </span>
          </summary>
          <div className="min-w-0 space-y-3 border-t border-white/10 p-3">
            <dl className="grid min-w-0 gap-2 sm:grid-cols-2">
              <MetadataValue label="Machine" value={session.machine} />
              <MetadataValue label="Workspace" value={session.workspaceId ?? "Unassociated"} />
              <MetadataValue label="Window count" value={session.windowCount} />
              <MetadataValue label="Pane count" value={session.paneCount} />
            </dl>
            <div>
              <p className="mb-1 text-[10px] uppercase tracking-[0.1em] text-violet-300/75">Notes</p>
              {session.notes.length > 0 ? (
                <ul className="space-y-1">
                  {session.notes.map((note, noteIndex) => <li key={noteIndex} className="break-words [overflow-wrap:anywhere]">{note}</li>)}
                </ul>
              ) : <p className="text-violet-300/75">No notes reported.</p>}
            </div>
          </div>
        </details>
      ))}
    </div>
  );
}

export default async function HabitatOpsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  try {
    requireOwner(session);
  } catch {
    redirect("/login");
  }

  const snapshot = await loadHabitatOpsSnapshot();
  const data = snapshot.data;
  const safetyLabels = ["READ ONLY", "DRY RUN ONLY", "NO LIVE MUTATION"];
  const modeLabels = snapshot.mode === "snapshot" ? ["SNAPSHOT MODE"] : ["FIXTURE ONLY"];
  const stateLabels = snapshot.snapshotState === "fresh" ? [] : [snapshot.stateLabel];

  return (
    <main className="mx-auto w-full max-w-[1400px] overflow-x-hidden px-3 pb-6 sm:px-4 md:px-8" style={{ paddingTop: "max(1rem, env(safe-area-inset-top))" }}>
      <header className="neon-panel mb-4 min-w-0 overflow-hidden rounded-xl px-4 py-4 sm:mb-6 sm:px-5 sm:py-5">
        <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-[0.25em] text-fuchsia-200/80 sm:text-xs">
              <Link href="/" className="hover:text-lime-300">gh-tracker</Link>
              {" / "}
              <span className="text-lime-300">Habitat /ops</span>
            </p>
            <h1 className="mt-1 font-sans text-xl uppercase tracking-[0.08em] text-white sm:text-3xl">
              Habitat /ops
            </h1>
            <p className="mt-1 max-w-3xl text-sm text-violet-100/80">
              {snapshot.stateMessage} This page reads sanitized snapshot data only and cannot mutate
              schedule, timer, session, or notification state.
            </p>
          </div>
          <Link
            href="/"
            className="max-w-full rounded border border-fuchsia-400/40 bg-black/30 px-2.5 py-1 text-[10px] uppercase tracking-[0.1em] text-violet-200 hover:bg-fuchsia-400/10"
          >
            Back to Dashboard
          </Link>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {[...safetyLabels, ...modeLabels, ...stateLabels].map((label) => (
            <SafetyBadge key={label} label={label} />
          ))}
        </div>
      </header>

      <section className="mb-4 grid min-w-0 gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Card title="Adapter Status">
          <p>{snapshot.stateMessage}</p>
          <p>Snapshot path: <span className="inline-block max-w-full font-mono text-cyan-200 break-words [overflow-wrap:anywhere]">{snapshot.snapshotPath}</span></p>
          <p>Freshness: {snapshot.freshnessMessage}</p>
          <p>Redaction: {snapshot.redactionMessage}</p>
          <p>Source machine (read-only): <span className="inline-block max-w-full font-mono text-cyan-200 break-words [overflow-wrap:anywhere]">{data.sourceMachine ?? "not reported"}</span></p>
          {snapshot.generatedAt && <p>Generated: {snapshot.generatedAt}</p>}
        </Card>

        <Card title="Notification Status">
          <p>{data.notification.discordSend}</p>
          <p>{data.notification.dedupeStatus}</p>
          <p>Report URL: {data.notification.reportUrl}</p>
          <p>{data.notification.redactionNote}</p>
          <p className="text-violet-300/75">{data.notification.transportNote}</p>
        </Card>

        <Card title="Schedule Inventory">
          <p>{data.scheduleInventory.userCrontabSummary}</p>
          <p>{data.scheduleInventory.systemTimersSummary}</p>
          <p>{data.scheduleInventory.readOnlyTargetCount}</p>
          <FixtureList lines={data.scheduleInventory.lines} />
          <p className="text-violet-300/75">{data.scheduleInventory.noMutationNote}</p>
        </Card>

        <Card title="Schedule Dry-Run">
          {data.scheduleDryRuns && data.scheduleDryRuns.length > 0 ? (
            <ScheduleTargets targets={data.scheduleDryRuns} />
          ) : (
            <>
              <p>Sample plan target: <span className="inline-block max-w-full font-mono text-lime-300 break-words [overflow-wrap:anywhere]">{data.scheduleDryRun.samplePlanTarget}</span></p>
              <PreviewBlock lines={data.scheduleDryRun.planLines} />
              <div>
                <p className="mb-2 text-[10px] uppercase tracking-[0.14em] text-violet-300/75">Enable Preview</p>
                <PreviewBlock lines={data.scheduleDryRun.enablePreview} />
              </div>
              <div>
                <p className="mb-2 text-[10px] uppercase tracking-[0.14em] text-violet-300/75">Disable Preview</p>
                <PreviewBlock lines={data.scheduleDryRun.disablePreview} />
              </div>
              <div>
                <p className="mb-2 text-[10px] uppercase tracking-[0.14em] text-violet-300/75">Run-Once Preview</p>
                <PreviewBlock lines={data.scheduleDryRun.runOncePreview} />
              </div>
            </>
          )}
        </Card>

        <Card title="Tmux Inventory">
          <p>{data.tmuxInventory.sessionCount}</p>
          <p>{data.tmuxInventory.windowCount}</p>
          <p>{data.tmuxInventory.paneCount}</p>
          {data.tmuxSessions === undefined ? <FixtureList lines={data.tmuxInventory.lines} /> : <TmuxSessions sessions={data.tmuxSessions} />}
          <p>{data.tmuxInventory.metadataOnlyNote}</p>
          <p className="text-violet-300/75">{data.tmuxInventory.noCaptureNote}</p>
        </Card>

        <Card title="Workspace Dry-Run">
          {data.workspaceDryRuns && data.workspaceDryRuns.length > 0 ? (
            <WorkspaceTargets targets={data.workspaceDryRuns} />
          ) : (
            <>
              <p>
                Canonical preview session: <span className="inline-block max-w-full font-mono text-lime-300 break-words [overflow-wrap:anywhere]">{data.workspaceDryRun.canonicalSessionPreview}</span>
              </p>
              <PreviewBlock lines={data.workspaceDryRun.previewLines} />
              <div>
                <p className="mb-2 text-[10px] uppercase tracking-[0.14em] text-violet-300/75">Copy-Only Guidance</p>
                <PreviewBlock lines={data.workspaceDryRun.copyOnlyLines} />
              </div>
              <p className="text-violet-300/75">{data.workspaceDryRun.noCreateReuseNote}</p>
            </>
          )}
        </Card>

        <Card title="Reports">
          <p>{data.reports.latestReport}</p>
          <p>Expected future URL style: <span className="inline-block max-w-full font-mono text-cyan-200 break-words [overflow-wrap:anywhere]">{data.reports.expectedUrlPattern}</span></p>
          <p className="text-violet-300/75">{data.reports.adapterStatus}</p>
        </Card>
      </section>

      <section className="neon-panel min-w-0 overflow-hidden rounded-xl p-4">
        <h2 className="font-sans text-sm uppercase tracking-[0.12em] text-fuchsia-200">Safety Summary</h2>
        <ul className="mt-3 space-y-2 text-sm text-violet-100/90">
          {data.footerSummary.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </section>
    </main>
  );
}
