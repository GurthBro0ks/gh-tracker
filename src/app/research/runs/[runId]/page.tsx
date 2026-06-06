import { redirect } from "next/navigation";
import Link from "next/link";
import {
  getResearchItems,
  findItemByRunId,
  bucketFromStatus,
  buildArtifactUrl,
} from "@/lib/research-farm";
import { getSession, requireOwner } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

function statusBadge(status: string) {
  const bucket = bucketFromStatus(status);
  let color = "border-white/20 bg-white/5 text-violet-200";
  let label = status;
  if (bucket === "queued") { color = "border-amber-300/50 bg-amber-400/10 text-amber-200"; label = "Quest Board"; }
  else if (bucket === "running") { color = "border-cyan-300/50 bg-cyan-400/10 text-cyan-200"; label = "Foraging"; }
  else if (bucket === "complete") { color = "border-lime-300/50 bg-lime-400/10 text-lime-200"; label = "Harvest"; }
  else if (bucket === "planned") { color = "border-violet-300/50 bg-violet-400/10 text-violet-200"; label = "Planned / Demo"; }
  return { color, label };
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return "—";
  try {
    return new Date(dateStr).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch {
    return dateStr;
  }
}

function ArtifactLink({ href, label, icon }: { href: string; label: string; icon: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2 rounded-lg border border-fuchsia-400/30 bg-black/30 p-2.5 text-xs text-violet-200 hover:bg-fuchsia-400/10 hover:text-white transition-colors"
    >
      <span className="text-base">{icon}</span>
      <span className="uppercase tracking-[0.08em]">{label}</span>
    </a>
  );
}

function MetadataRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex justify-between gap-3 border-b border-white/5 py-1.5 text-xs">
      <span className="text-violet-300/70 uppercase tracking-[0.08em]">{label}</span>
      <span className="text-violet-100 text-right">{value || "—"}</span>
    </div>
  );
}

export default async function RunDetailPage({ params }: { params: Promise<{ runId: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");
  try {
    requireOwner(session);
  } catch {
    redirect("/login");
  }

  const { runId } = await params;
  const items = getResearchItems();
  const item = findItemByRunId(items, runId);

  if (!item) {
    return (
      <main className="mx-auto w-full max-w-[1000px] px-3 pb-6 sm:px-4 md:px-8" style={{ paddingTop: "max(1rem, env(safe-area-inset-top))" }}>
        <div className="neon-panel rounded-xl p-6 text-center">
          <p className="text-sm text-rose-300">Run not found: {runId}</p>
          <Link href="/research" className="mt-3 inline-block text-xs text-lime-300 hover:underline">
            Back to Research Farm
          </Link>
        </div>
      </main>
    );
  }

  const badge = statusBadge(item.status);
  const isPlanned = item.status === "planned";

  const runDir = `runs/${item.immutable_run_id}`;

  return (
    <main className="mx-auto w-full max-w-[1000px] px-3 pb-6 sm:px-4 md:px-8" style={{ paddingTop: "max(1rem, env(safe-area-inset-top))" }}>
      <header className="neon-panel mb-4 rounded-xl px-3 py-3 sm:mb-6 sm:px-5 sm:py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-[0.25em] text-fuchsia-200/80 sm:text-xs">
              <Link href="/" className="hover:text-lime-300">gh-tracker</Link>
              {" / "}
              <Link href="/research" className="hover:text-lime-300">Research Farm</Link>
              {" / "}
              <span className="text-lime-300">Proof Burrow</span>
            </p>
            <h1 className="mt-1 font-sans text-lg uppercase tracking-[0.08em] text-white sm:text-2xl">
              {item.title}
            </h1>
            <p className="mt-0.5 text-xs text-violet-100/80">{item.slug}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className={`rounded border px-2 py-0.5 text-[10px] uppercase tracking-[0.1em] ${badge.color}`}>
              {badge.label}
            </span>
            {isPlanned && (
              <span className="rounded border border-amber-300/40 bg-amber-400/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.1em] text-amber-200">
                Demo Run
              </span>
            )}
            <Link
              href="/research"
              className="rounded border border-fuchsia-400/40 bg-black/30 px-2.5 py-1 text-[10px] uppercase tracking-[0.1em] text-violet-200 hover:bg-fuchsia-400/10"
            >
              Back
            </Link>
          </div>
        </div>
      </header>

      <section className="neon-panel mb-4 rounded-xl p-3 sm:mb-6 sm:p-4">
        <h2 className="font-sans text-sm uppercase tracking-[0.12em] text-fuchsia-200">Run Metadata</h2>
        <div className="mt-3 space-y-0">
          <MetadataRow label="Run ID" value={item.immutable_run_id} />
          <MetadataRow label="Status" value={badge.label} />
          <MetadataRow label="Priority" value={item.priority} />
          <MetadataRow label="Depth" value={item.depth} />
          <MetadataRow label="Confidence" value={item.confidence ?? "—"} />
          <MetadataRow label="Sources" value={String(item.source_count)} />
          <MetadataRow label="Citations" value={String(item.citation_count)} />
          <MetadataRow label="Created" value={formatDate(item.created_at)} />
          <MetadataRow label="Started" value={formatDate(item.started_at)} />
          <MetadataRow label="Completed" value={formatDate(item.completed_at)} />
          <MetadataRow label="Model" value={item.model_used} />
          <MetadataRow label="Runner" value={item.runner_version} />
          {item.assigned_critter && <MetadataRow label="Critter" value={item.assigned_critter} />}
        </div>
        {item.tags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1">
            {item.tags.map((tag) => (
              <span key={tag} className="chip rounded px-1.5 py-0.5 text-[9px] uppercase tracking-[0.08em]">
                {tag}
              </span>
            ))}
          </div>
        )}
      </section>

      <section className="neon-panel mb-4 rounded-xl p-3 sm:mb-6 sm:p-4">
        <h2 className="font-sans text-sm uppercase tracking-[0.12em] text-fuchsia-200">Proof Burrow Artifacts</h2>
        <p className="mt-1 text-[10px] text-violet-300/70 sm:text-xs">
          Owner-gated access to research artifacts. All files streamed from the Knowledge Base.
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {item.almanac_path && (
            <ArtifactLink
              href={buildArtifactUrl(item.almanac_path)}
              label="Open Almanac HTML"
              icon="📜"
            />
          )}
          {item.pdf_path && (
            <ArtifactLink
              href={buildArtifactUrl(item.pdf_path)}
              label="Open PDF"
              icon="📄"
            />
          )}
          <ArtifactLink
            href={buildArtifactUrl(`${runDir}/report.md`)}
            label="Open Report"
            icon="📝"
          />
          <ArtifactLink
            href={buildArtifactUrl(`${runDir}/critic.md`)}
            label="Open Critic Notes"
              icon="🔍"
          />
          <ArtifactLink
            href={buildArtifactUrl(`${runDir}/RESULT.md`)}
            label="Open RESULT"
            icon="✅"
          />
          <ArtifactLink
            href={buildArtifactUrl(`${runDir}/sources.jsonl`)}
            label="Open Sources"
            icon="📚"
          />
          <ArtifactLink
            href={buildArtifactUrl(`${runDir}/citations.json`)}
            label="Open Citations"
            icon="🔖"
          />
          <ArtifactLink
            href={buildArtifactUrl(`${runDir}/run.json`)}
            label="Open run.json"
            icon="⚙"
          />
        </div>
      </section>

      {item.proof_path && (
        <section className="neon-panel rounded-xl p-3 sm:p-4">
          <h2 className="font-sans text-sm uppercase tracking-[0.12em] text-fuchsia-200">Proof Burrow Path</h2>
          <p className="mt-1 font-mono text-xs text-violet-100 break-all">
            /home/slimy/kb/research/{item.proof_path}
          </p>
        </section>
      )}
    </main>
  );
}
