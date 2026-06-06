import { redirect } from "next/navigation";
import Link from "next/link";
import {
  getResearchItems,
  computeResearchStats,
  bucketFromStatus,
  buildArtifactUrl,
  readQueuedTopics,
  type ResearchIndexItem,
} from "@/lib/research-farm";
import { getSession, requireOwner } from "@/lib/auth/session";
import { QuestBoard } from "@/components/quest-board";

export const dynamic = "force-dynamic";

function statusBadgeColor(bucket: string) {
  if (bucket === "queued") return "border-amber-300/50 bg-amber-400/10 text-amber-200";
  if (bucket === "running") return "border-cyan-300/50 bg-cyan-400/10 text-cyan-200";
  if (bucket === "complete") return "border-lime-300/50 bg-lime-400/10 text-lime-200";
  if (bucket === "planned") return "border-violet-300/50 bg-violet-400/10 text-violet-200";
  return "border-white/20 bg-white/5 text-violet-200";
}

function statusLabel(status: string) {
  if (status === "queued") return "Quest Board";
  if (status === "running") return "Foraging";
  if (status === "complete") return "Harvest";
  if (status === "planned") return "Planned / Demo";
  return status;
}

function priorityColor(priority: string) {
  if (priority === "high") return "text-rose-300";
  if (priority === "low") return "text-violet-300/70";
  return "text-violet-200";
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return "—";
  try {
    return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return dateStr;
  }
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-lg border border-fuchsia-400/30 bg-black/35 p-3">
      <p className="text-[10px] uppercase tracking-[0.14em] text-violet-300">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${color}`}>{value}</p>
    </div>
  );
}

function ItemCard({ item }: { item: ResearchIndexItem }) {
  const bucket = bucketFromStatus(item.status);
  const hasAlmanac = !!(item.pdf_path || item.almanac_path);

  return (
    <article className="neon-panel rounded-xl p-3 sm:p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <Link
            href={`/research/runs/${item.immutable_run_id}`}
            className="font-sans text-sm uppercase tracking-[0.06em] text-white hover:text-lime-300 sm:text-base"
          >
            {item.title}
          </Link>
          <p className="mt-0.5 text-[10px] text-violet-300/70 sm:text-xs">{item.slug}</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <span className={`rounded border px-2 py-0.5 text-[10px] uppercase tracking-[0.1em] ${statusBadgeColor(bucket)}`}>
            {statusLabel(item.status)}
          </span>
          <span className={`rounded border border-fuchsia-400/25 bg-black/20 px-2 py-0.5 text-[10px] ${priorityColor(item.priority)}`}>
            {item.priority}
          </span>
        </div>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
        <div>
          <span className="text-violet-300/70">Depth</span>
          <p className="text-violet-100">{item.depth}</p>
        </div>
        <div>
          <span className="text-violet-300/70">Confidence</span>
          <p className="text-violet-100">{item.confidence ?? "—"}</p>
        </div>
        <div>
          <span className="text-violet-300/70">Sources</span>
          <p className="text-lime-300">{item.source_count}</p>
        </div>
        <div>
          <span className="text-violet-300/70">Citations</span>
          <p className="text-lime-300">{item.citation_count}</p>
        </div>
      </div>

      {item.assigned_critter && (
        <p className="mt-1.5 text-[10px] text-cyan-200">
          Critter: <span className="font-bold">{item.assigned_critter}</span>
        </p>
      )}

      {item.tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {item.tags.map((tag) => (
            <span key={tag} className="chip rounded px-1.5 py-0.5 text-[9px] uppercase tracking-[0.08em]">
              {tag}
            </span>
          ))}
        </div>
      )}

      <div className="mt-2 grid grid-cols-3 gap-2 text-[10px] text-violet-300/70">
        <div>Created: {formatDate(item.created_at)}</div>
        <div>Started: {formatDate(item.started_at)}</div>
        <div>Completed: {formatDate(item.completed_at)}</div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Link
          href={`/research/runs/${item.immutable_run_id}`}
          className="rounded border border-fuchsia-400/40 bg-black/30 px-2.5 py-1 text-[10px] uppercase tracking-[0.1em] text-violet-200 hover:bg-fuchsia-400/10"
        >
          Open Proof Burrow
        </Link>
        {hasAlmanac && item.pdf_path && (
          <a
            href={buildArtifactUrl(item.pdf_path)}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded border border-lime-300/40 bg-lime-400/10 px-2.5 py-1 text-[10px] uppercase tracking-[0.1em] text-lime-200 hover:bg-lime-400/20"
          >
            Open Almanac PDF
          </a>
        )}
      </div>
    </article>
  );
}

export default async function ResearchFarmPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  try {
    requireOwner(session);
  } catch {
    redirect("/login");
  }

  const items = getResearchItems();
  const stats = computeResearchStats(items);
  const queuedTopics = readQueuedTopics();
  const seedCount = queuedTopics.filter((t) => t.status === "queued").length;

  return (
    <main className="mx-auto w-full max-w-[1500px] px-3 pb-6 sm:px-4 md:px-8" style={{ paddingTop: "max(1rem, env(safe-area-inset-top))" }}>
      <header className="neon-panel mb-4 rounded-xl px-3 py-3 sm:mb-6 sm:px-5 sm:py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-[0.25em] text-fuchsia-200/80 sm:text-xs">
              <Link href="/" className="hover:text-lime-300">gh-tracker</Link>
              {" / "}
              <span className="text-lime-300">Research Farm</span>
            </p>
            <h1 className="mt-1 font-sans text-xl uppercase tracking-[0.08em] text-white sm:text-3xl">
              Research Farm
            </h1>
            <p className="mt-0.5 text-xs text-violet-100/80 sm:mt-1 sm:text-sm">
              A habitat for deep research quests, foraging runs, and harvested almanacs.
              Plant seeds on the Quest Board and create planned runs.
            </p>
          </div>
          <Link
            href="/"
            className="rounded border border-fuchsia-400/40 bg-black/30 px-2.5 py-1 text-[10px] uppercase tracking-[0.1em] text-violet-200 hover:bg-fuchsia-400/10"
          >
            Back to Dashboard
          </Link>
        </div>
      </header>

      <section className="mb-4 grid grid-cols-2 gap-2 sm:mb-6 sm:grid-cols-3 sm:gap-4 lg:grid-cols-6">
        <StatCard label="Seeds" value={seedCount} color="text-amber-200" />
        <StatCard label="Quest Board" value={stats.queued} color="text-amber-200" />
        <StatCard label="Foraging" value={stats.running} color="text-cyan-200" />
        <StatCard label="Harvest" value={stats.complete} color="text-lime-300" />
        <StatCard label="Planned" value={stats.planned} color="text-violet-200" />
        <StatCard label="Almanacs" value={stats.almanacsAvailable} color="text-fuchsia-200" />
      </section>

      <div className="mb-6">
        <QuestBoard topics={queuedTopics} />
      </div>

      {items.length === 0 ? (
        <section className="neon-panel rounded-xl p-6 text-center">
          <p className="text-sm text-violet-300/70">
            No research items found. The Quest Board is empty.
          </p>
          <p className="mt-1 text-[10px] text-violet-300/50">
            Research index: /home/slimy/kb/research/indexes/index.json
          </p>
        </section>
      ) : (
        <section className="space-y-4">
          <h2 className="font-sans text-sm uppercase tracking-[0.12em] text-fuchsia-200">
            All Research Items
          </h2>
          {items.map((item) => (
            <ItemCard key={item.immutable_run_id} item={item} />
          ))}
        </section>
      )}
    </main>
  );
}
