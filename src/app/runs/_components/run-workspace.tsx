import Link from "next/link";
import { toReportsSsoBridgeUrl } from "../../../lib/harness-session-index";
import type { RunProjection } from "../../../lib/run-projection";
import {
  INVALID_PROJECTION_FIXTURE_ID,
  buildContinuationText,
  type InvalidRunWorkspaceFixture,
  type RunWorkspaceFixture,
} from "../_lib/fixtures";
import { CopyControl } from "./copy-control";

const AXES = [
  ["Execution", "execution"],
  ["Evidence", "evidence"],
  ["Review", "review"],
  ["Acceptance", "acceptance"],
  ["Owner", "owner_action"],
  ["Notify", "notification"],
] as const;

const POSITIVE_STATES = new Set([
  "COMPLETED",
  "CAPTURED",
  "PASS",
  "ACCEPTED",
  "DONE",
  "SENT",
  "DEDUPED",
  "RELAYED",
]);
const DANGER_STATES = new Set(["FAILED", "FAIL", "REJECTED", "CANCELLED"]);
const WARNING_STATES = new Set([
  "ACTIVE",
  "PENDING",
  "INCOMPLETE",
  "WARN",
  "OWNER_QA_PENDING",
  "OWNER_DECISION_PENDING",
  "CONDITIONALLY_ACCEPTED",
]);

function stateTone(value: string): string {
  if (POSITIVE_STATES.has(value)) return "border-lime-300/45 bg-lime-400/10 text-lime-100";
  if (DANGER_STATES.has(value)) return "border-rose-300/55 bg-rose-400/10 text-rose-100";
  if (WARNING_STATES.has(value)) return "border-amber-300/50 bg-amber-400/10 text-amber-100";
  return "border-violet-300/35 bg-violet-400/10 text-violet-100";
}

function AxisGrid({ projection, compact = false }: { projection: RunProjection; compact?: boolean }) {
  return (
    <div className="grid min-w-0 grid-cols-3 gap-2" aria-label="Six-axis run status">
      {AXES.map(([label, key]) => {
        const value = projection.state[key];
        return (
          <div key={key} className="min-w-0">
            <p className="truncate text-[9px] uppercase tracking-[0.08em] text-violet-300 sm:text-[10px]">{label}</p>
            <p className={`mt-1 min-w-0 rounded border px-1.5 py-1 text-center text-[9px] font-semibold break-words [overflow-wrap:anywhere] sm:text-[10px] ${stateTone(value)}`}>
              {compact ? value.replaceAll("_", " ") : value}
            </p>
          </div>
        );
      })}
    </div>
  );
}

function FixtureBanner({ projection }: { projection: RunProjection }) {
  const markers = [
    projection.flags.test_fixture_only ? "TEST_FIXTURE_ONLY=true" : null,
    !projection.flags.production_acceptance_enabled
      ? "production_acceptance_enabled=false"
      : null,
    projection.flags.production_storage_active === false
      ? "production_storage_active=false"
      : null,
  ].filter((marker): marker is string => Boolean(marker));

  if (markers.length === 0) return null;
  return (
    <div className="rounded-lg border border-rose-300/55 bg-rose-400/10 px-3 py-2 text-xs text-rose-100" role="alert">
      <p className="font-sans uppercase tracking-[0.1em]">Fixture only — no production authority</p>
      <p className="mt-1 font-mono break-words [overflow-wrap:anywhere]">{markers.join(" · ")}</p>
    </div>
  );
}

function Section({ title, summary, children }: { title: string; summary?: string; children: React.ReactNode }) {
  return (
    <details className="group min-w-0 rounded-xl border border-white/10 bg-black/25">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 px-3 py-2 text-xs uppercase tracking-[0.08em] text-fuchsia-100 marker:hidden sm:text-sm">
        <span>{title}</span>
        <span className="text-right text-[10px] normal-case tracking-normal text-violet-300 sm:text-xs">{summary ?? "Open"}</span>
      </summary>
      <div className="min-w-0 border-t border-white/10 px-3 py-3 text-xs text-violet-100/90 sm:text-sm">
        {children}
      </div>
    </details>
  );
}

function EmptyList({ text }: { text: string }) {
  return <p className="text-violet-300">{text}</p>;
}

export function RunWorkspaceIndex({ fixtures }: { fixtures: RunWorkspaceFixture[] }) {
  return (
    <main className="mx-auto w-full max-w-5xl overflow-x-hidden px-3 pb-8 pt-4 sm:px-5 md:px-8">
      <header className="neon-panel rounded-xl p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-[0.22em] text-fuchsia-200">Habitat / Run Workspace</p>
            <h1 className="mt-1 font-sans text-2xl uppercase tracking-[0.08em] text-white sm:text-3xl">Runs</h1>
            <p className="mt-2 max-w-2xl text-sm text-violet-100/80">
              Latest synthetic run-projection fixtures. This protected preview reads no production run data.
            </p>
          </div>
          <Link href="/harness" className="flex min-h-11 items-center rounded border border-fuchsia-300/40 bg-black/25 px-3 py-2 text-xs uppercase tracking-[0.08em] text-fuchsia-100 hover:bg-fuchsia-400/10">
            Harness dashboard
          </Link>
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-[10px] uppercase tracking-[0.1em]">
          <span className="rounded border border-rose-300/50 bg-rose-400/10 px-2 py-1 text-rose-100">Fixture only</span>
          <span className="rounded border border-cyan-300/40 bg-cyan-400/10 px-2 py-1 text-cyan-100">Read only</span>
          <span className="rounded border border-violet-300/35 bg-violet-400/10 px-2 py-1 text-violet-100">{fixtures.length} of 50</span>
        </div>
      </header>

      <section className="mt-4 space-y-3" aria-label="Fixture runs">
        {fixtures.map((fixture) => {
          const projection = fixture.projection;
          return (
            <Link key={projection.run.run_id} href={projection.links.workspace_path} className="neon-panel block min-h-11 min-w-0 rounded-xl p-4 hover:border-lime-300/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime-200">
              <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <h2 className="font-sans text-sm text-white break-words [overflow-wrap:anywhere] sm:text-base">{projection.run.phase}</h2>
                  <p className="mt-1 text-xs text-violet-300">{projection.run.project_id} · {fixture.freshnessLabel}</p>
                </div>
                <span className="rounded border border-rose-300/40 bg-rose-400/10 px-2 py-1 text-[9px] uppercase tracking-[0.08em] text-rose-100">Fixture</span>
              </div>
              <div className="mt-3"><AxisGrid projection={projection} compact /></div>
              <p className="mt-3 font-mono text-[10px] text-cyan-200 break-all sm:text-xs">{projection.run.run_id}</p>
            </Link>
          );
        })}

        <Link href={`/runs/${INVALID_PROJECTION_FIXTURE_ID}`} className="block min-h-11 rounded-xl border border-amber-300/35 bg-amber-400/10 p-4 text-amber-100 hover:bg-amber-400/15">
          <h2 className="font-sans text-sm uppercase tracking-[0.08em]">Invalid projection fixture</h2>
          <p className="mt-1 text-xs">Exercises the fail-closed schema refusal view without exposing raw invalid input.</p>
        </Link>
      </section>
    </main>
  );
}

export function RunWorkspaceDetail({ fixture }: { fixture: RunWorkspaceFixture }) {
  const projection = fixture.projection;
  const continuationText = buildContinuationText(projection);
  const reportHref = projection.links.report_url
    ? toReportsSsoBridgeUrl(projection.links.report_url)
    : null;
  const passed = projection.state.review === "PASS" ? "passed" : projection.state.review.toLowerCase();

  return (
    <main className="mx-auto w-full max-w-5xl overflow-x-hidden px-3 pb-8 pt-4 sm:px-5 md:px-8">
      <header className="neon-panel min-w-0 overflow-hidden rounded-xl p-4 sm:p-5">
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
          <Link href="/runs" className="flex min-h-11 items-center text-xs uppercase tracking-[0.1em] text-fuchsia-200 hover:text-lime-200">← Runs</Link>
          <span className="text-xs text-violet-300 break-words [overflow-wrap:anywhere]">{projection.run.project_id}</span>
        </div>
        <h1 className="mt-2 font-sans text-xl uppercase tracking-[0.06em] text-white break-words [overflow-wrap:anywhere] sm:text-3xl">{projection.run.phase}</h1>
        <div className="mt-2"><CopyControl compact label={projection.run.run_id} value={projection.run.run_id} /></div>

        <div className="mt-4"><FixtureBanner projection={projection} /></div>
        <div className="mt-4"><AxisGrid projection={projection} /></div>

        <p className="mt-4 rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-sm text-violet-100">
          Validation {passed}. Owner acceptance: {projection.state.acceptance}.
          {projection.state.owner_action === "OWNER_QA_PENDING" ? " Awaiting owner QA." : ""}
        </p>
        <p className={`mt-3 text-xs ${fixture.freshnessLabel === "stale" ? "text-amber-200" : "text-violet-300"}`}>
          Projection generated {projection.generated_at} · {fixture.freshnessLabel}.
          {fixture.terminal ? " Execution is terminal; no automatic refresh is running." : " Fixture preview does not poll."}
        </p>

        <section className="mt-4 rounded-lg border border-lime-300/35 bg-lime-400/10 px-3 py-3">
          <h2 className="text-[10px] uppercase tracking-[0.16em] text-lime-200">Next recommended action</h2>
          <p className="mt-1 text-sm text-white">{projection.next_action ?? "No next action was recorded."}</p>
        </section>

        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {reportHref ? (
            <Link href={reportHref} className="flex min-h-11 items-center justify-center rounded border border-fuchsia-300/45 bg-fuchsia-400/10 px-3 py-2 text-center text-xs uppercase tracking-[0.08em] text-fuchsia-100 hover:bg-fuchsia-400/20">Permanent report ↗</Link>
          ) : (
            <span aria-disabled="true" className="flex min-h-11 items-center justify-center rounded border border-white/15 bg-black/25 px-3 py-2 text-center text-xs uppercase tracking-[0.08em] text-violet-400">Permanent report not yet available</span>
          )}
          {continuationText ? (
            <CopyControl label="Copy continuation" value={continuationText} />
          ) : (
            <span aria-disabled="true" className="flex min-h-11 items-center justify-center rounded border border-white/15 bg-black/25 px-3 py-2 text-center text-xs uppercase tracking-[0.08em] text-violet-400">Continuation not recorded</span>
          )}
        </div>
      </header>

      <section className="mt-4 space-y-2" aria-label="Run projection details">
        <Section title="Validation" summary={`${projection.validation.checks.length} checks`}>
          <p>{projection.validation.summary}</p>
          <p className="mt-2">Deep validation: {projection.validation.deep_validation}{projection.validation.deep_validation_at ? ` at ${projection.validation.deep_validation_at}` : " (no recorded time)"}</p>
          {projection.validation.checks.length ? (
            <div className="mt-3 space-y-2">
              {projection.validation.checks.map((check) => (
                <div key={check.id} className="rounded border border-white/10 bg-black/20 p-2">
                  <p className="text-white">{check.name}: {check.status}</p>
                  <p className="mt-1 text-violet-300">{check.passed} passed · {check.failed} failed · {check.total} total</p>
                  <p className="mt-1 font-mono text-cyan-200 break-all">{check.source_artifact}</p>
                </div>
              ))}
            </div>
          ) : <EmptyList text="No validation checks are recorded in this fixture." />}
        </Section>

        <Section title="Evidence" summary={projection.evidence.status}>
          <p>{projection.evidence.summary}</p>
          <p className="mt-2">Checked: {projection.evidence.checked_at ?? "not reverified"}</p>
          <p className="mt-2 font-mono text-cyan-200 break-all">{projection.evidence.proof_dir ?? "No proof directory recorded"}</p>
          {projection.evidence.proof_dir?.startsWith("/tmp/") ? <p className="mt-2 text-amber-200">/tmp is not durable.</p> : null}
        </Section>

        <Section title="Artifacts" summary={`${projection.artifacts.count} files`}>
          <p>{projection.artifacts.filter_explanation}</p>
          {projection.artifacts.displayed_files.length ? (
            <ul className="mt-3 space-y-1 font-mono text-cyan-200">
              {projection.artifacts.displayed_files.map((file) => <li key={file} className="break-all">{file}</li>)}
            </ul>
          ) : <EmptyList text="No artifact names are displayed." />}
        </Section>

        <Section title="Warnings / blockers" summary={`${projection.state.warnings.length + projection.state.blockers.length}`}>
          <h3 className="text-xs uppercase tracking-[0.08em] text-amber-200">Warnings</h3>
          {projection.state.warnings.length ? <ul className="mt-2 list-disc space-y-1 pl-5">{projection.state.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul> : <EmptyList text="No warnings recorded." />}
          <h3 className="mt-4 text-xs uppercase tracking-[0.08em] text-rose-200">Blockers</h3>
          {projection.state.blockers.length ? <ul className="mt-2 list-disc space-y-1 pl-5">{projection.state.blockers.map((blocker) => <li key={blocker}>{blocker}</li>)}</ul> : <EmptyList text="No blockers recorded." />}
          {projection.acceptance.limitations.length ? <><h3 className="mt-4 text-xs uppercase tracking-[0.08em] text-violet-200">Limitations</h3><ul className="mt-2 list-disc space-y-1 pl-5">{projection.acceptance.limitations.map((limitation) => <li key={limitation}>{limitation}</li>)}</ul></> : null}
          {projection.acceptance.superseded_by ? <p className="mt-4">Superseded by <Link className="text-cyan-200 underline" href={`/runs/${projection.acceptance.superseded_by}`}>{projection.acceptance.superseded_by}</Link></p> : null}
        </Section>

        <Section title="Continuation handoff" summary={continuationText ? "Fixture available" : "Not recorded"}>
          {continuationText ? (
            <>
              <p className="mb-3 text-amber-200">Fixture-only handoff. Copied authorization is not transitive and cannot authorize a new action.</p>
              <pre className="max-w-full overflow-x-auto whitespace-pre-wrap break-words rounded border border-white/10 bg-black/40 p-3 font-mono text-[10px] text-cyan-100 sm:text-xs">{continuationText}</pre>
            </>
          ) : <EmptyList text="No continuation object is present in this fixture." />}
        </Section>

        <Section title="Raw JSON" summary="Projection only">
          <p className="mb-3 text-violet-300">Sanitized run-projection.v1 fixture only; no run record, ledger, RESULT.md, logs, or proof contents.</p>
          <pre className="max-w-full overflow-x-auto whitespace-pre-wrap break-words rounded border border-white/10 bg-black/40 p-3 font-mono text-[10px] text-cyan-100 sm:text-xs">{JSON.stringify(projection, null, 2)}</pre>
        </Section>
      </section>
    </main>
  );
}

export function RunWorkspaceUnavailable({ result }: { result: InvalidRunWorkspaceFixture | { kind: "missing"; runId: string } }) {
  const invalid = result.kind === "invalid";
  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-2xl items-center overflow-x-hidden px-3 py-8 sm:px-5">
      <section className="neon-panel w-full min-w-0 rounded-xl p-5 sm:p-7">
        <p className="text-[10px] uppercase tracking-[0.2em] text-fuchsia-200">Habitat / Run Workspace</p>
        <h1 className="mt-2 font-sans text-2xl uppercase tracking-[0.06em] text-white">{invalid ? "Invalid projection" : "Run not found"}</h1>
        <p className="mt-3 text-sm text-violet-100/90">
          {invalid ? result.message : "No fixture run projection exists for this ID. Nothing is inferred and no run content is shown."}
        </p>
        <p className="mt-3 font-mono text-xs text-cyan-200 break-all">{result.runId}</p>
        {invalid ? <p className="mt-2 text-xs text-amber-200">Failure class: {result.errorClass}</p> : <p className="mt-2 text-xs text-violet-300">Historical sessions without run records remain in Reports.</p>}
        <div className="mt-5 grid gap-2 sm:grid-cols-2">
          <Link href="/runs" className="flex min-h-11 items-center justify-center rounded border border-fuchsia-300/40 bg-fuchsia-400/10 px-3 py-2 text-xs uppercase tracking-[0.08em] text-fuchsia-100">Back to fixture runs</Link>
          <Link href={toReportsSsoBridgeUrl("https://harness.slimyai.xyz/reports")} className="flex min-h-11 items-center justify-center rounded border border-cyan-300/40 bg-cyan-400/10 px-3 py-2 text-xs uppercase tracking-[0.08em] text-cyan-100">Open reports index ↗</Link>
        </div>
      </section>
    </main>
  );
}
