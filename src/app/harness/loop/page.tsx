import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession, requireOwner } from "@/lib/auth/session";
import { loadHabitatLoopStatusSnapshot } from "@/lib/harness-loop-status-snapshot";
import type { LoopStatusDisplayState, LoopStatusItemView } from "@/lib/harness-loop-status-fixtures";

export const dynamic = "force-dynamic";

const STATUS_TONE: Record<LoopStatusDisplayState, string> = {
  OK: "border-lime-300/50 bg-lime-400/10 text-lime-100",
  WARN: "border-amber-300/50 bg-amber-400/10 text-amber-100",
  BLOCKED: "border-orange-300/50 bg-orange-400/10 text-orange-100",
  FAIL: "border-rose-300/55 bg-rose-400/10 text-rose-100",
  UNKNOWN: "border-violet-300/40 bg-violet-400/10 text-violet-100",
};

function SafetyBadge({ label }: { label: string }) {
  return (
    <span className="max-w-full rounded border border-amber-300/40 bg-amber-400/10 px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-amber-200 break-words [overflow-wrap:anywhere]">
      {label}
    </span>
  );
}

function StatusBadge({ status }: { status: LoopStatusDisplayState }) {
  return (
    <span className={`inline-block rounded border px-2 py-1 text-[10px] uppercase tracking-[0.12em] ${STATUS_TONE[status]}`}>
      {status}
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

function ItemCard({ item }: { item: LoopStatusItemView }) {
  return (
    <article className="min-w-0 rounded-xl border border-white/10 bg-black/25 p-3">
      <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-sans text-xs uppercase tracking-[0.08em] text-white break-words [overflow-wrap:anywhere] sm:text-sm">{item.title}</p>
          <p className="mt-0.5 text-[10px] text-violet-300 break-words [overflow-wrap:anywhere] sm:text-xs">{item.phase}</p>
        </div>
        <StatusBadge status={item.status} />
      </div>
      <dl className="mt-2 grid gap-1.5 text-[10px] text-violet-100 sm:grid-cols-2 sm:text-xs">
        <div className="min-w-0 rounded border border-white/10 bg-black/20 px-2 py-1">
          <dt className="text-violet-300/75">Proof gate verdict</dt>
          <dd className="break-words [overflow-wrap:anywhere]">{item.proofGateVerdict || "unknown"}</dd>
        </div>
        <div className="min-w-0 rounded border border-white/10 bg-black/20 px-2 py-1">
          <dt className="text-violet-300/75">Manual QA status</dt>
          <dd className="break-words [overflow-wrap:anywhere]">{item.manualQaStatus || "unknown"}</dd>
        </div>
        <div className="min-w-0 rounded border border-white/10 bg-black/20 px-2 py-1">
          <dt className="text-violet-300/75">Next required gate</dt>
          <dd className="break-words [overflow-wrap:anywhere]">{item.nextRequiredGate || "none"}</dd>
        </div>
        <div className="min-w-0 rounded border border-white/10 bg-black/20 px-2 py-1">
          <dt className="text-violet-300/75">Updated</dt>
          <dd className="break-words [overflow-wrap:anywhere]">{item.updatedAt || "unknown"}</dd>
        </div>
      </dl>
      {item.blockedReason ? (
        <p className="mt-2 min-w-0 rounded border border-rose-300/25 bg-rose-400/10 px-2 py-1 text-[10px] text-rose-100 break-words [overflow-wrap:anywhere] sm:text-xs">
          Blocked reason: {item.blockedReason}
        </p>
      ) : null}
    </article>
  );
}

export default async function HabitatLoopStatusPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  try {
    requireOwner(session);
  } catch {
    redirect("/login");
  }

  const snapshot = await loadHabitatLoopStatusSnapshot();
  const data = snapshot.data;
  const safetyLabels = ["READ ONLY", "NO MUTATION CONTROLS"];
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
              <Link href="/harness" className="hover:text-lime-300">Habitat Harness</Link>
              {" / "}
              <span className="text-lime-300">Loop</span>
            </p>
            <h1 className="mt-1 font-sans text-xl uppercase tracking-[0.08em] text-white sm:text-3xl">
              Habitat Harness Loop Status
            </h1>
            <p className="mt-1 max-w-3xl text-sm text-violet-100/80">
              {snapshot.stateMessage} This page reads a sanitized static snapshot only and cannot
              mutate queue or proof state.
            </p>
          </div>
          <Link
            href="/harness"
            className="max-w-full rounded border border-fuchsia-400/40 bg-black/30 px-2.5 py-1 text-[10px] uppercase tracking-[0.1em] text-violet-200 hover:bg-fuchsia-400/10"
          >
            Back to Harness Dashboard
          </Link>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {[...safetyLabels, ...modeLabels, ...stateLabels].map((label) => (
            <SafetyBadge key={label} label={label} />
          ))}
        </div>
      </header>

      <section className="mb-4 grid min-w-0 gap-4 md:grid-cols-2">
        <Card title="Snapshot Status">
          <p>{snapshot.stateMessage}</p>
          <p>Snapshot path: <span className="inline-block max-w-full font-mono text-cyan-200 break-words [overflow-wrap:anywhere]">{snapshot.snapshotPath}</span></p>
          {snapshot.generatedAt && <p>Generated: {snapshot.generatedAt}</p>}
        </Card>

        <Card title="Summary">
          <p>Total items: {data.summary.totalItems}</p>
          <p>Highest risk state: <StatusBadge status={data.summary.highestRiskState} /></p>
          <p>Has blockers: {data.summary.hasBlockers ? "yes" : "no"}</p>
          <p>Has failures: {data.summary.hasFailures ? "yes" : "no"}</p>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(data.summary.byStatus) as LoopStatusDisplayState[]).map((state) => (
              <span key={state} className="rounded border border-white/10 bg-black/25 px-2 py-1 text-[10px] uppercase tracking-[0.1em] text-violet-200 sm:text-xs">
                {state}: {data.summary.byStatus[state]}
              </span>
            ))}
          </div>
          {Object.keys(data.summary.byGate).length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {Object.entries(data.summary.byGate).map(([gate, count]) => (
                <span key={gate} className="rounded border border-white/10 bg-black/20 px-2 py-1 text-[10px] text-violet-300 break-words [overflow-wrap:anywhere] sm:text-xs">
                  {gate}: {count}
                </span>
              ))}
            </div>
          ) : null}
        </Card>
      </section>

      <section className="neon-panel mb-4 min-w-0 overflow-hidden rounded-xl p-4">
        <h2 className="font-sans text-sm uppercase tracking-[0.12em] text-fuchsia-200">Loop Items</h2>
        {data.items.length === 0 ? (
          <p className="mt-3 rounded border border-white/10 bg-black/25 px-3 py-4 text-center text-xs text-violet-200">
            No loop items are present in this snapshot.
          </p>
        ) : (
          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            {data.items.map((item, index) => (
              <ItemCard key={`${item.phase}-${item.title}-${index}`} item={item} />
            ))}
          </div>
        )}
      </section>

      <section className="neon-panel min-w-0 overflow-hidden rounded-xl p-4">
        <h2 className="font-sans text-sm uppercase tracking-[0.12em] text-fuchsia-200">Safety Summary</h2>
        <div className="mt-3 grid gap-2 text-[10px] sm:grid-cols-2 sm:text-xs">
          <p className="rounded border border-white/10 bg-black/25 px-2 py-1 text-violet-100">Shell execution present: {data.safety.shellExecutionPresent ? "yes" : "no"}</p>
          <p className="rounded border border-white/10 bg-black/25 px-2 py-1 text-violet-100">Mutation controls present: {data.safety.mutationControlsPresent ? "yes" : "no"}</p>
          <p className="rounded border border-white/10 bg-black/25 px-2 py-1 text-violet-100">Request-time shell required: {data.safety.requestTimeShellRequired ? "yes" : "no"}</p>
          <p className="rounded border border-white/10 bg-black/25 px-2 py-1 text-violet-100">Secrets redacted: {data.safety.secretsRedacted ? "yes" : "no"}</p>
          <p className="rounded border border-white/10 bg-black/25 px-2 py-1 text-violet-100">Owner gate required for UI: {data.safety.ownerGateRequiredForUi ? "yes" : "no"}</p>
        </div>
        <ul className="mt-3 space-y-2 text-sm text-violet-100/90">
          {data.footerSummary.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </section>
    </main>
  );
}
