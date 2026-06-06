"use client";

import { useState } from "react";

interface QuestBoardProps {
  topics: Array<{
    slug: string;
    title: string;
    status: string;
    priority: string;
    depth: string;
    tags: string[];
    created_at: string | null;
    assigned_critter: string;
    campaign: string;
    question: string;
  }>;
}

export function QuestBoard({ topics: initialTopics }: QuestBoardProps) {
  const [topics, setTopics] = useState(initialTopics);
  const [showForm, setShowForm] = useState(false);
  const [planStatus, setPlanStatus] = useState<Record<string, string>>({});
  const [formData, setFormData] = useState({
    title: "",
    question: "",
    depth: "deep",
    priority: "normal",
    tags: "",
    campaign: "",
    assigned_critter: "",
    scope_notes: "",
    constraints: "",
  });
  const [submitError, setSubmitError] = useState("");
  const [submitSuccess, setSubmitSuccess] = useState("");

  function resetForm() {
    setFormData({
      title: "",
      question: "",
      depth: "deep",
      priority: "normal",
      tags: "",
      campaign: "",
      assigned_critter: "",
      scope_notes: "",
      constraints: "",
    });
    setSubmitError("");
    setSubmitSuccess("");
  }

  async function handleCreateSeed(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError("");
    setSubmitSuccess("");

    try {
      const res = await fetch("/api/research/topics", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(formData),
      });
      const data = await res.json();

      if (!res.ok) {
        setSubmitError(data.error || "failed to create seed");
        return;
      }

      setSubmitSuccess(`Seed "${data.slug}" planted!`);
      resetForm();
      setShowForm(false);
      setTopics((prev) => [
        ...prev,
        {
          slug: data.slug,
          title: formData.title,
          status: "queued",
          priority: formData.priority,
          depth: formData.depth,
          tags: formData.tags.split(",").map((t) => t.trim()).filter(Boolean),
          created_at: new Date().toISOString().slice(0, 10),
          assigned_critter: formData.assigned_critter,
          campaign: formData.campaign,
          question: formData.question.length > 120 ? formData.question.slice(0, 117) + "..." : formData.question,
        },
      ]);
    } catch {
      setSubmitError("network error");
    }
  }

  async function handlePlanRun(slug: string) {
    setPlanStatus((prev) => ({ ...prev, [slug]: "planning..." }));

    try {
      const res = await fetch("/api/research/runs/plan", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ slug }),
      });
      const data = await res.json();

      if (!res.ok) {
        setPlanStatus((prev) => ({ ...prev, [slug]: `error: ${data.error}` }));
        return;
      }

      setPlanStatus((prev) => ({ ...prev, [slug]: "planned!" }));
      setTopics((prev) => prev.filter((t) => t.slug !== slug));
    } catch {
      setPlanStatus((prev) => ({ ...prev, [slug]: "network error" }));
    }
  }

  const queuedTopics = topics.filter((t) => t.status === "queued");

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-sans text-sm uppercase tracking-[0.12em] text-amber-200">
          Quest Board ({queuedTopics.length} seed{queuedTopics.length !== 1 ? "s" : ""})
        </h2>
        <button
          type="button"
          onClick={() => { setShowForm(!showForm); resetForm(); }}
          className="rounded border border-amber-300/40 bg-amber-400/10 px-3 py-1.5 text-[10px] uppercase tracking-[0.1em] text-amber-200 hover:bg-amber-400/20 transition-colors"
        >
          {showForm ? "Cancel" : "Plant New Seed"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreateSeed} className="neon-panel rounded-xl p-4 space-y-3">
          <h3 className="font-sans text-xs uppercase tracking-[0.1em] text-fuchsia-200">
            Plant a Research Seed
          </h3>

          <div>
            <label className="block text-[10px] uppercase tracking-[0.08em] text-violet-300/80 mb-1">
              Title *
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData((f) => ({ ...f, title: e.target.value }))}
              className="w-full rounded border border-fuchsia-400/30 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-violet-300/40 focus:border-lime-300/50 focus:outline-none"
              placeholder="Self-hosted deep research agent architecture"
              required
              minLength={3}
            />
          </div>

          <div>
            <label className="block text-[10px] uppercase tracking-[0.08em] text-violet-300/80 mb-1">
              Research Question *
            </label>
            <textarea
              value={formData.question}
              onChange={(e) => setFormData((f) => ({ ...f, question: e.target.value }))}
              className="w-full rounded border border-fuchsia-400/30 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-violet-300/40 focus:border-lime-300/50 focus:outline-none resize-y min-h-[60px]"
              placeholder="What is the best architecture for..."
              required
              minLength={5}
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div>
              <label className="block text-[10px] uppercase tracking-[0.08em] text-violet-300/80 mb-1">Depth</label>
              <select
                value={formData.depth}
                onChange={(e) => setFormData((f) => ({ ...f, depth: e.target.value }))}
                className="w-full rounded border border-fuchsia-400/30 bg-black/40 px-2 py-1.5 text-xs text-white focus:border-lime-300/50 focus:outline-none"
              >
                <option value="quick">Quick</option>
                <option value="standard">Standard</option>
                <option value="deep">Deep</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-[0.08em] text-violet-300/80 mb-1">Priority</label>
              <select
                value={formData.priority}
                onChange={(e) => setFormData((f) => ({ ...f, priority: e.target.value }))}
                className="w-full rounded border border-fuchsia-400/30 bg-black/40 px-2 py-1.5 text-xs text-white focus:border-lime-300/50 focus:outline-none"
              >
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-[0.08em] text-violet-300/80 mb-1">Critter</label>
              <input
                type="text"
                value={formData.assigned_critter}
                onChange={(e) => setFormData((f) => ({ ...f, assigned_critter: e.target.value }))}
                className="w-full rounded border border-fuchsia-400/30 bg-black/40 px-2 py-1.5 text-xs text-white placeholder:text-violet-300/40 focus:border-lime-300/50 focus:outline-none"
                placeholder="optional"
              />
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-[0.08em] text-violet-300/80 mb-1">Campaign</label>
              <input
                type="text"
                value={formData.campaign}
                onChange={(e) => setFormData((f) => ({ ...f, campaign: e.target.value }))}
                className="w-full rounded border border-fuchsia-400/30 bg-black/40 px-2 py-1.5 text-xs text-white placeholder:text-violet-300/40 focus:border-lime-300/50 focus:outline-none"
                placeholder="optional"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] uppercase tracking-[0.08em] text-violet-300/80 mb-1">Tags (comma-separated)</label>
            <input
              type="text"
              value={formData.tags}
              onChange={(e) => setFormData((f) => ({ ...f, tags: e.target.value }))}
              className="w-full rounded border border-fuchsia-400/30 bg-black/40 px-3 py-2 text-xs text-white placeholder:text-violet-300/40 focus:border-lime-300/50 focus:outline-none"
              placeholder="ai-agents, nuc, habitat"
            />
          </div>

          <div>
            <label className="block text-[10px] uppercase tracking-[0.08em] text-violet-300/80 mb-1">Scope Notes</label>
            <textarea
              value={formData.scope_notes}
              onChange={(e) => setFormData((f) => ({ ...f, scope_notes: e.target.value }))}
              className="w-full rounded border border-fuchsia-400/30 bg-black/40 px-3 py-2 text-xs text-white placeholder:text-violet-300/40 focus:border-lime-300/50 focus:outline-none resize-y min-h-[40px]"
              placeholder="What matters for this research..."
              rows={2}
            />
          </div>

          <div>
            <label className="block text-[10px] uppercase tracking-[0.08em] text-violet-300/80 mb-1">Constraints</label>
            <textarea
              value={formData.constraints}
              onChange={(e) => setFormData((f) => ({ ...f, constraints: e.target.value }))}
              className="w-full rounded border border-fuchsia-400/30 bg-black/40 px-3 py-2 text-xs text-white placeholder:text-violet-300/40 focus:border-lime-300/50 focus:outline-none resize-y min-h-[40px]"
              placeholder="One constraint per line..."
              rows={2}
            />
          </div>

          {submitError && (
            <p className="text-xs text-rose-300">{submitError}</p>
          )}
          {submitSuccess && (
            <p className="text-xs text-lime-300">{submitSuccess}</p>
          )}

          <button
            type="submit"
            className="rounded border border-lime-300/40 bg-lime-400/10 px-4 py-2 text-[10px] uppercase tracking-[0.1em] text-lime-200 hover:bg-lime-400/20 transition-colors"
          >
            Plant Seed on Quest Board
          </button>
        </form>
      )}

      {queuedTopics.length === 0 && !showForm ? (
        <div className="neon-panel rounded-xl p-4 text-center">
          <p className="text-xs text-violet-300/60">
            No seeds on the Quest Board. Plant one to start a research quest.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {queuedTopics.map((topic) => (
            <article key={topic.slug} className="neon-panel rounded-xl p-3 sm:p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="font-sans text-sm uppercase tracking-[0.06em] text-amber-200">
                    {topic.title}
                  </h3>
                  <p className="mt-0.5 text-[10px] text-violet-300/70">{topic.slug}</p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <span className="rounded border border-amber-300/50 bg-amber-400/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.1em] text-amber-200">
                    Quest Board
                  </span>
                  <span className={`rounded border border-fuchsia-400/25 bg-black/20 px-2 py-0.5 text-[10px] ${topic.priority === "high" ? "text-rose-300" : topic.priority === "low" ? "text-violet-300/70" : "text-violet-200"}`}>
                    {topic.priority}
                  </span>
                </div>
              </div>

              <p className="mt-2 text-xs text-violet-100/80 line-clamp-2">{topic.question}</p>

              <div className="mt-2 grid grid-cols-2 gap-2 text-[10px] text-violet-300/70">
                <div>Depth: <span className="text-violet-100">{topic.depth}</span></div>
                <div>Created: {topic.created_at || "—"}</div>
                {topic.assigned_critter && (
                  <div>Critter: <span className="text-cyan-200 font-bold">{topic.assigned_critter}</span></div>
                )}
                {topic.campaign && (
                  <div>Campaign: <span className="text-fuchsia-200">{topic.campaign}</span></div>
                )}
              </div>

              {topic.tags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {topic.tags.map((tag) => (
                    <span key={tag} className="chip rounded px-1.5 py-0.5 text-[9px] uppercase tracking-[0.08em]">
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              <div className="mt-3">
                <button
                  type="button"
                  onClick={() => handlePlanRun(topic.slug)}
                  disabled={planStatus[topic.slug]?.startsWith("plan") || planStatus[topic.slug] === "planned!"}
                  className="rounded border border-violet-300/40 bg-violet-400/10 px-3 py-1.5 text-[10px] uppercase tracking-[0.1em] text-violet-200 hover:bg-violet-400/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {planStatus[topic.slug] === "planning..."
                    ? "Planning..."
                    : planStatus[topic.slug] === "planned!"
                      ? "Planned!"
                      : "Create Planned Run"}
                </button>
                {planStatus[topic.slug] && planStatus[topic.slug] !== "planning..." && planStatus[topic.slug] !== "planned!" && (
                  <p className="mt-1 text-[10px] text-rose-300">{planStatus[topic.slug]}</p>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
