import { readFileSync, existsSync } from "fs";
import { resolve, extname, posix } from "path";
import { readFile } from "fs/promises";

const KB_RESEARCH_ROOT = process.env.KB_RESEARCH_ROOT || "/home/slimy/kb/research";
const INDEX_PATH = resolve(KB_RESEARCH_ROOT, "indexes/index.json");

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
