import { readFileSync, existsSync, writeFileSync, readdirSync, mkdirSync } from "fs";
import { resolve, extname, posix } from "path";
import { readFile } from "fs/promises";
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

const KB_RESEARCH_ROOT = process.env.KB_RESEARCH_ROOT || "/home/slimy/kb/research";
const KB_ROOT = process.env.KB_ROOT || "/home/slimy/kb";
const INDEX_PATH = resolve(KB_RESEARCH_ROOT, "indexes/index.json");
const TOPICS_DIR = resolve(KB_RESEARCH_ROOT, "topics");
const PLAN_SCRIPT = resolve(KB_ROOT, "tools/research-plan-run.sh");

const ALLOWED_EXTENSIONS = new Set([".html", ".pdf", ".md", ".json", ".jsonl", ".txt"]);

export interface ResearchIndexItem {
  immutable_run_id: string;
  slug: string;
  title: string;
  status: string;
  priority: string;
  depth: string;
  confidence: string | null;
  source_count: number;
  citation_count: number;
  created_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  model_used: string | null;
  runner_version: string | null;
  pdf_path: string | null;
  report_path: string | null;
  critic_path: string | null;
  proof_path: string | null;
  topic_path: string | null;
  tags: string[];
  related_harness_session: string | null;
  related_guild_campaign: string | null;
  assigned_critter: string | null;
  almanac_path?: string | null;
  almanac_generated_at?: string | null;
  pdf_generated_at?: string | null;
}

export interface ResearchIndex {
  schema_version: number;
  generated_at: string;
  source_root: string;
  ui_theme: string;
  items: ResearchIndexItem[];
}

export function readResearchIndex(): ResearchIndex | null {
  try {
    if (!existsSync(INDEX_PATH)) return null;
    const raw = readFileSync(INDEX_PATH, "utf8");
    return JSON.parse(raw) as ResearchIndex;
  } catch {
    return null;
  }
}

export function getResearchItems(): ResearchIndexItem[] {
  const index = readResearchIndex();
  if (!index) return [];
  return index.items;
}

export type ResearchStatusBucket = "queued" | "running" | "complete" | "planned" | "unknown";

export function bucketFromStatus(status: string): ResearchStatusBucket {
  if (status === "queued") return "queued";
  if (status === "running") return "running";
  if (status === "complete") return "complete";
  if (status === "planned") return "planned";
  return "unknown";
}

export interface ResearchStats {
  total: number;
  queued: number;
  running: number;
  complete: number;
  planned: number;
  almanacsAvailable: number;
}

export function computeResearchStats(items: ResearchIndexItem[]): ResearchStats {
  let queued = 0;
  let running = 0;
  let complete = 0;
  let planned = 0;
  let almanacsAvailable = 0;

  for (const item of items) {
    const bucket = bucketFromStatus(item.status);
    if (bucket === "queued") queued++;
    else if (bucket === "running") running++;
    else if (bucket === "complete") complete++;
    else if (bucket === "planned") planned++;
    if (item.pdf_path || item.almanac_path) almanacsAvailable++;
  }

  return { total: items.length, queued, running, complete, planned, almanacsAvailable };
}

export interface ArtifactValidationResult {
  valid: boolean;
  error?: string;
  resolvedPath?: string;
}

export function validateArtifactPath(userPath: string): ArtifactValidationResult {
  if (!userPath || typeof userPath !== "string") {
    return { valid: false, error: "empty path" };
  }

  if (userPath.startsWith("/") || userPath.includes("..")) {
    return { valid: false, error: "path traversal rejected" };
  }

  const resolvedRoot = resolve(KB_RESEARCH_ROOT);
  const resolved = resolve(KB_RESEARCH_ROOT, userPath);

  if (!resolved.startsWith(resolvedRoot + "/") && resolved !== resolvedRoot) {
    return { valid: false, error: "path escapes research root" };
  }

  const ext = extname(resolved).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return { valid: false, error: `extension ${ext} not allowed` };
  }

  return { valid: true, resolvedPath: resolved };
}

const CONTENT_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".pdf": "application/pdf",
  ".md": "text/markdown; charset=utf-8",
  ".json": "application/json",
  ".jsonl": "application/x-ndjson",
  ".txt": "text/plain; charset=utf-8",
};

export function getContentType(filePath: string): string {
  const ext = extname(filePath).toLowerCase();
  return CONTENT_TYPES[ext] || "application/octet-stream";
}

export async function readArtifactFile(
  userPath: string
): Promise<{ data: Buffer; contentType: string } | null> {
  const validation = validateArtifactPath(userPath);
  if (!validation.valid || !validation.resolvedPath) return null;

  if (!existsSync(validation.resolvedPath)) return null;

  const data = await readFile(validation.resolvedPath);
  const contentType = getContentType(validation.resolvedPath);
  return { data, contentType };
}

export function findItemByRunId(items: ResearchIndexItem[], runId: string): ResearchIndexItem | null {
  return items.find((item) => item.immutable_run_id === runId) ?? null;
}

export function buildArtifactUrl(basePath: string): string {
  return `/api/research/artifacts/${posix.normalize(basePath)}`;
}

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function sanitizeSlug(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function isValidSlug(slug: string): boolean {
  return SLUG_RE.test(slug) && slug.length >= 2 && slug.length <= 120;
}

export interface TopicSeed {
  title: string;
  question: string;
  depth: string;
  priority: string;
  tags: string[];
  campaign: string;
  assigned_critter: string;
  scope_notes: string;
  constraints: string;
  audience: string;
  visibility: string;
}

const VALID_DEPTHS = new Set(["quick", "standard", "deep"]);
const VALID_PRIORITIES = new Set(["low", "normal", "high", "urgent"]);

export function validateTopicSeed(seed: Partial<TopicSeed>): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!seed.title || seed.title.trim().length < 3) {
    errors.push("title is required (minimum 3 characters)");
  }
  if (!seed.question || seed.question.trim().length < 5) {
    errors.push("question is required (minimum 5 characters)");
  }
  const depth = seed.depth || "deep";
  if (!VALID_DEPTHS.has(depth)) {
    errors.push(`depth must be one of: quick, standard, deep`);
  }
  const priority = seed.priority || "normal";
  if (!VALID_PRIORITIES.has(priority)) {
    errors.push(`priority must be one of: low, normal, high, urgent`);
  }

  return { valid: errors.length === 0, errors };
}

export function renderTopicMarkdown(slug: string, seed: TopicSeed): string {
  const today = new Date().toISOString().slice(0, 10);
  const tagsYaml = seed.tags.length > 0
    ? seed.tags.map((t) => `  - ${t}`).join("\n")
    : "  []";
  const constraintsYaml = seed.constraints
    ? seed.constraints.split("\n").filter(Boolean).map((c) => `  - "${c.replace(/"/g, '\\"')}"`).join("\n")
    : "  []";

  return `---
type: research_topic
status: queued
priority: ${seed.priority || "normal"}
depth: ${seed.depth || "deep"}
output: presentation_pdf
title: ${seed.title}
slug: ${slug}
created_by: Gurth
created_at: ${today}
audience: ${seed.audience || "technical_owner"}
visibility: ${seed.visibility || "owner"}
tags:
${tagsYaml}
seed_kind: question
question: "${seed.question.replace(/"/g, '\\"')}"
scope_notes: "${(seed.scope_notes || "").replace(/"/g, '\\"')}"
constraints:
${constraintsYaml}
related_projects: []
assigned_critter: "${seed.assigned_critter || ""}"
campaign: "${seed.campaign || ""}"
claim_token: ""
claimed_at: ""
started_at: ""
completed_at: ""
supersedes: ""
superseded_by: ""
---

# Question

${seed.question}

# What matters

${seed.scope_notes || "No scope notes provided."}

# Constraints

${seed.constraints || "No explicit constraints."}
`;
}

export interface CreateTopicResult {
  success: boolean;
  slug: string;
  filePath: string;
  error?: string;
}

export function createTopicFile(slug: string, seed: TopicSeed): CreateTopicResult {
  if (!isValidSlug(slug)) {
    return { success: false, slug, filePath: "", error: "invalid slug" };
  }

  if (slug.includes("..") || slug.includes("/")) {
    return { success: false, slug, filePath: "", error: "path traversal rejected" };
  }

  const filePath = resolve(TOPICS_DIR, `${slug}.md`);
  const topicsResolved = resolve(TOPICS_DIR);

  if (!filePath.startsWith(topicsResolved + "/")) {
    return { success: false, slug, filePath: "", error: "path escapes topics directory" };
  }

  if (existsSync(filePath)) {
    return { success: false, slug, filePath, error: "topic already exists" };
  }

  const content = renderTopicMarkdown(slug, seed);

  mkdirSync(TOPICS_DIR, { recursive: true });
  writeFileSync(filePath, content, { encoding: "utf8", flag: "wx" });

  return { success: true, slug, filePath };
}

export interface QueuedTopic {
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
}

function parseFrontmatter(text: string): Record<string, unknown> | null {
  if (!text.startsWith("---")) return null;
  const end = text.indexOf("---", 3);
  if (end === -1) return null;
  const fmText = text.slice(3, end).trim();
  const result: Record<string, unknown> = {};
  for (const line of fmText.split("\n")) {
    const match = line.match(/^(\w[\w_]*):\s*(.*)$/);
    if (!match) continue;
    const [, key, rawVal] = match;
    const val = rawVal.trim();
    if (val.startsWith("[") || val.startsWith('"') || val === "[]") {
      try {
        result[key] = JSON.parse(val.replace(/'/g, '"'));
      } catch {
        result[key] = val.replace(/^["']|["']$/g, "");
      }
    } else if (val === "null" || val === "") {
      result[key] = null;
    } else {
      result[key] = val;
    }
  }
  return result;
}

export function readQueuedTopics(): QueuedTopic[] {
  if (!existsSync(TOPICS_DIR)) return [];

  const topics: QueuedTopic[] = [];
  const files = readdirSync(TOPICS_DIR).filter((f) => f.endsWith(".md"));

  for (const file of files) {
    const filePath = resolve(TOPICS_DIR, file);
    try {
      const content = readFileSync(filePath, "utf8");
      const fm = parseFrontmatter(content);
      if (!fm || fm.type !== "research_topic") continue;

      const slug = String(fm.slug || file.replace(/\.md$/, ""));
      const questionRaw = fm.question as string | undefined;
      const question = (questionRaw || "").replace(/^["']|["']$/g, "");

      topics.push({
        slug,
        title: String(fm.title || slug),
        status: String(fm.status || "queued"),
        priority: String(fm.priority || "normal"),
        depth: String(fm.depth || "deep"),
        tags: Array.isArray(fm.tags) ? fm.tags.map(String) : [],
        created_at: fm.created_at ? String(fm.created_at) : null,
        assigned_critter: String(fm.assigned_critter || ""),
        campaign: String(fm.campaign || ""),
        question: question.length > 120 ? question.slice(0, 117) + "..." : question,
      });
    } catch {
      continue;
    }
  }

  return topics.sort((a, b) => (a.created_at || "").localeCompare(b.created_at || ""));
}

export interface PlanRunResult {
  success: boolean;
  runId?: string;
  error?: string;
  stdout?: string;
  stderr?: string;
}

export async function planRunFromTopic(slug: string): Promise<PlanRunResult> {
  if (!isValidSlug(slug)) {
    return { success: false, error: "invalid slug" };
  }
  if (slug.includes("..") || slug.includes("/")) {
    return { success: false, error: "path traversal rejected" };
  }

  const topicFile = resolve(TOPICS_DIR, `${slug}.md`);
  const topicsResolved = resolve(TOPICS_DIR);
  if (!topicFile.startsWith(topicsResolved + "/")) {
    return { success: false, error: "path escapes topics directory" };
  }
  if (!existsSync(topicFile)) {
    return { success: false, error: "topic not found" };
  }

  const topicRelative = `research/topics/${slug}.md`;

  try {
    const { stdout, stderr } = await execFileAsync(
      PLAN_SCRIPT,
      ["create-run", topicRelative],
      {
        cwd: KB_ROOT,
        timeout: 30000,
        maxBuffer: 1024 * 1024,
      }
    );

    const today = new Date().toISOString().slice(0, 10);
    const runId = `${today}-${slug}`;

    return { success: true, runId, stdout, stderr };
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    return { success: false, error };
  }
}

export function refreshIndex(): ResearchIndex | null {
  return readResearchIndex();
}

export function getTopicsDir(): string {
  return TOPICS_DIR;
}
