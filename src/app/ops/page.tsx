import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession, requireOwner } from "@/lib/auth/session";
import { loadHabitatOpsSnapshot } from "@/lib/harness-ops-snapshot";

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
        </Card>

        <Card title="Tmux Inventory">
          <p>{data.tmuxInventory.sessionCount}</p>
          <p>{data.tmuxInventory.windowCount}</p>
          <p>{data.tmuxInventory.paneCount}</p>
          <FixtureList lines={data.tmuxInventory.lines} />
          <p>{data.tmuxInventory.metadataOnlyNote}</p>
          <p className="text-violet-300/75">{data.tmuxInventory.noCaptureNote}</p>
        </Card>

        <Card title="Workspace Dry-Run">
          <p>
            Canonical preview session: <span className="inline-block max-w-full font-mono text-lime-300 break-words [overflow-wrap:anywhere]">{data.workspaceDryRun.canonicalSessionPreview}</span>
          </p>
          <PreviewBlock lines={data.workspaceDryRun.previewLines} />
          <div>
            <p className="mb-2 text-[10px] uppercase tracking-[0.14em] text-violet-300/75">Copy-Only Guidance</p>
            <PreviewBlock lines={data.workspaceDryRun.copyOnlyLines} />
          </div>
          <p className="text-violet-300/75">{data.workspaceDryRun.noCreateReuseNote}</p>
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
