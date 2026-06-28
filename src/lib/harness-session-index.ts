import { readFile, stat } from "node:fs/promises";
import { ZodError } from "zod";
import { harnessSessionIndexSchema, type HarnessSafeValue, type HarnessSessionSummaryRaw } from "./harness-session-index-schema";

export const HARNESS_SESSION_INDEX_PATH = "/home/slimy/slimy-kb/raw/sessions/harness-session-index.json";
export const MISSION_CONTROL_REPORTS_URL = "https://harness.slimyai.xyz/reports";
export const REPORTS_SSO_BRIDGE_PATH = "/reports/sso-bridge";

const STALE_AFTER_HOURS = 24;
const MAX_SAFE_TEXT_LENGTH = 220;

export type HarnessIndexStatus = "ready" | "missing" | "invalid_json" | "schema_mismatch" | "empty";

export type HarnessSessionView = {
  id: string;
  sourceReport: string;
  phase: string | null;
  result: string | null;
  status: string | null;
  project: string | null;
  repo: string | null;
  featureId: string | null;
  machine: string | null;
  nuc: string | null;
  commit: string | null;
  pushed: boolean | null;
  proofDir: string | null;
  reportUrl: string;
  reportUrlSource: "report_url" | "source_report";
  timestamp: string | null;
  durationMinutes: number | null;
  manualQaStatus: string | null;
  discordSent: boolean | null;
  notifyMode: string | null;
  dedupeResult: string | null;
  warnings: string[];
  failures: string[];
  nextAction: string | null;
  safetyFlags: string[];
  isWarn: boolean;
  isFail: boolean;
  isBlocked: boolean;
  isManualQaPending: boolean;
  sortTime: number;
};

export type HarnessIndexSummary = {
  totalSessions: number;
  passCount: number;
  warnCount: number;
  failCount: number;
  blockedCount: number;
  warningSessionCount: number;
  failureSessionCount: number;
  manualQaPendingCount: number;
  closeoutCount: number;
  safetyFlagCount: number;
  reportLinkCount: number;
};

export type HarnessSessionIndexView = {
  status: HarnessIndexStatus;
  dataSource: string;
  canonicalReportsUrl: string;
  canonicalSessionsUrl: string;
  generatedAt: string | null;
  generatedBy: string | null;
  sourceMachine: string | null;
  schemaVersion: string | null;
  declaredSessionCount: number | null;
  maxSessionTimestamp: string | null;
  maxSessionAgeMinutes: number | null;
  fileSizeBytes: number | null;
  isStale: boolean;
  ageMinutes: number | null;
  message: string;
  sessions: HarnessSessionView[];
  latestSessions: HarnessSessionView[];
  warningSessions: HarnessSessionView[];
  manualQaSessions: HarnessSessionView[];
  summary: HarnessIndexSummary;
};

export async function loadHarnessSessionIndex(indexPath = HARNESS_SESSION_INDEX_PATH, now = new Date()): Promise<HarnessSessionIndexView> {
  let fileSizeBytes: number | null = null;
  let raw: string;

  try {
    const stats = await stat(indexPath);
    fileSizeBytes = stats.size;
    raw = await readFile(indexPath, "utf8");
  } catch (error) {
    const code = error instanceof Error && "code" in error ? (error as NodeJS.ErrnoException).code : null;
    if (code === "ENOENT") {
      return emptyIndexView("missing", indexPath, "Live harness session index is missing. The dashboard is read-only and will show data after the safe exporter places the index.", fileSizeBytes);
    }
    return emptyIndexView("missing", indexPath, "Live harness session index could not be read. Check file permissions and exporter placement.", fileSizeBytes);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return emptyIndexView("invalid_json", indexPath, "Live harness session index is not valid JSON. Mission-control remains the canonical report viewer.", fileSizeBytes);
  }

  const validated = harnessSessionIndexSchema.safeParse(parsed);
  if (!validated.success) {
    return emptyIndexView("schema_mismatch", indexPath, formatSchemaMessage(validated.error), fileSizeBytes);
  }

  const generatedAt = safeString(validated.data.generated_at);
  const ageMinutes = minutesSince(generatedAt, now);
  const isStale = ageMinutes !== null && ageMinutes > STALE_AFTER_HOURS * 60;
  const sessions = validated.data.sessions
    .map(normalizeSession)
    .sort((a, b) => b.sortTime - a.sortTime || a.id.localeCompare(b.id));
  const maxSessionTimestamp = newestSessionTimestamp(sessions);
  const maxSessionAgeMinutes = minutesSince(maxSessionTimestamp, now);
  const schemaVersion = validated.data.schema_version ?? validated.data.schema ?? null;

  const status: HarnessIndexStatus = sessions.length > 0 ? "ready" : "empty";
  const message = indexMessage(status, isStale, generatedAt, maxSessionTimestamp);

  return {
    status,
    dataSource: indexPath,
    canonicalReportsUrl: toReportsSsoBridgeUrl(MISSION_CONTROL_REPORTS_URL),
    canonicalSessionsUrl: toReportsSsoBridgeUrl(`${MISSION_CONTROL_REPORTS_URL}/sessions`),
    generatedAt,
    generatedBy: safeString(validated.data.generated_by),
    sourceMachine: safeString(validated.data.source_machine),
    schemaVersion,
    declaredSessionCount: validated.data.session_count ?? null,
    maxSessionTimestamp,
    maxSessionAgeMinutes,
    fileSizeBytes,
    isStale,
    ageMinutes,
    message,
    sessions,
    latestSessions: sessions.slice(0, 12),
    warningSessions: sessions.filter((session) => session.isWarn || session.isFail || session.isBlocked).slice(0, 12),
    manualQaSessions: sessions.filter((session) => session.isManualQaPending).slice(0, 12),
    summary: buildSummary(sessions),
  };
}

function emptyIndexView(status: HarnessIndexStatus, dataSource: string, message: string, fileSizeBytes: number | null): HarnessSessionIndexView {
  return {
    status,
    dataSource,
    canonicalReportsUrl: toReportsSsoBridgeUrl(MISSION_CONTROL_REPORTS_URL),
    canonicalSessionsUrl: toReportsSsoBridgeUrl(`${MISSION_CONTROL_REPORTS_URL}/sessions`),
    generatedAt: null,
    generatedBy: null,
    sourceMachine: null,
    schemaVersion: null,
    declaredSessionCount: null,
    maxSessionTimestamp: null,
    maxSessionAgeMinutes: null,
    fileSizeBytes,
    isStale: false,
    ageMinutes: null,
    message,
    sessions: [],
    latestSessions: [],
    warningSessions: [],
    manualQaSessions: [],
    summary: buildSummary([]),
  };
}

function indexMessage(status: HarnessIndexStatus, isStale: boolean, generatedAt: string | null, maxSessionTimestamp: string | null) {
  if (status === "empty") return "Live harness session index is valid but has zero sessions.";
  if (isStale) return `Live harness session index is older than ${STALE_AFTER_HOURS} hours.`;
  if (generatedAt) return "Live harness session index loaded from safe metadata.";
  if (maxSessionTimestamp) return "Live harness session index loaded; generated freshness is unknown, using safe session dates.";
  return "Live harness session index loaded; freshness unknown because no safe date fields are available.";
}

function normalizeSession(raw: HarnessSessionSummaryRaw, index: number): HarnessSessionView {
  const sourceReport = safeString(raw.source_report) ?? `unknown-source-report-${index}.json`;
  const rawReportUrl = safeUrl(raw.report_url) ?? `${MISSION_CONTROL_REPORTS_URL}/sessions/${encodeURIComponent(sourceReport)}`;
  const reportUrl = toReportsSsoBridgeUrl(rawReportUrl);
  const reportUrlSource = safeUrl(raw.report_url) ? "report_url" : "source_report";
  const timestamp = firstSafeString(raw.created_at, raw.archived_at, raw.reported_at, raw.timestamp, raw.finished_at, raw.started_at);
  const result = safeString(raw.result);
  const status = safeString(raw.status);
  const phase = safeString(raw.phase);
  const manualQaStatus = safeString(raw.manual_qa_status);
  const warnings = safeStringArray(raw.warnings);
  const failures = safeStringArray(raw.failures);
  const safetyFlags = buildSafetyFlags(raw);
  const classificationText = [result, status, phase, ...warnings, ...failures].filter(Boolean).join(" ").toLowerCase();

  return {
    id: safeString(raw.session_id) ?? sourceReport,
    sourceReport,
    phase,
    result,
    status,
    project: safeString(raw.project),
    repo: safeString(raw.repo),
    featureId: safeString(raw.feature_id),
    machine: safeString(raw.machine),
    nuc: safeString(raw.nuc),
    commit: safeString(raw.commit) ?? safeString(raw.head),
    pushed: safeBoolean(raw.pushed),
    proofDir: safeString(raw.proof_dir),
    reportUrl,
    reportUrlSource,
    timestamp,
    durationMinutes: safeNumber(raw.duration_minutes),
    manualQaStatus,
    discordSent: safeBoolean(raw.discord_sent),
    notifyMode: safeString(raw.notify_mode),
    dedupeResult: safeString(raw.dedupe_result),
    warnings,
    failures,
    nextAction: safeString(raw.next_action),
    safetyFlags,
    isWarn: warnings.length > 0 || classificationText.includes("warn"),
    isFail: failures.length > 0 || classificationText.includes("fail") || classificationText.includes("error"),
    isBlocked: classificationText.includes("block"),
    isManualQaPending: isManualQaPending(manualQaStatus),
    sortTime: timestamp ? Date.parse(timestamp) || 0 : 0,
  };
}

export function toReportsSsoBridgeUrl(reportUrl: string): string {
  const target = getReportsReturnUrl(reportUrl) ?? MISSION_CONTROL_REPORTS_URL;
  return `${REPORTS_SSO_BRIDGE_PATH}?returnTo=${encodeURIComponent(target)}`;
}

function getReportsReturnUrl(reportUrl: string): string | null {
  try {
    const url = new URL(reportUrl);
    if (url.hostname !== "harness.slimyai.xyz") return null;
    if (!url.pathname.startsWith("/reports")) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function buildSummary(sessions: HarnessSessionView[]): HarnessIndexSummary {
  return {
    totalSessions: sessions.length,
    passCount: sessions.filter((session) => hasAny(session.result, session.status, ["pass", "passed", "accepted", "complete", "completed"])).length,
    warnCount: sessions.filter((session) => session.isWarn).length,
    failCount: sessions.filter((session) => session.isFail).length,
    blockedCount: sessions.filter((session) => session.isBlocked).length,
    warningSessionCount: sessions.filter((session) => session.warnings.length > 0).length,
    failureSessionCount: sessions.filter((session) => session.failures.length > 0).length,
    manualQaPendingCount: sessions.filter((session) => session.isManualQaPending).length,
    closeoutCount: sessions.filter((session) => [session.phase, session.sourceReport, session.featureId].filter(Boolean).join(" ").toLowerCase().includes("closeout")).length,
    safetyFlagCount: sessions.reduce((sum, session) => sum + session.safetyFlags.length, 0),
    reportLinkCount: sessions.filter((session) => Boolean(session.reportUrl)).length,
  };
}

function newestSessionTimestamp(sessions: HarnessSessionView[]): string | null {
  const newest = sessions.find((session) => session.sortTime > 0 && session.timestamp);
  return newest?.timestamp ?? null;
}

function buildSafetyFlags(raw: HarnessSessionSummaryRaw): string[] {
  const flags: Array<[string, HarnessSafeValue]> = [
    ["service restart", raw.services_restarted],
    ["Caddy changed", raw.caddy_changed],
    ["DNS changed", raw.dns_changed],
    ["cron changed", raw.cron_changed],
    ["timer changed", raw.timer_changed],
    ["tmux changed", raw.tmux_changed],
    ["secrets printed", raw.secrets_printed],
    ["webhook values printed", raw.webhook_values_printed],
  ];
  return flags.filter(([, value]) => safeBoolean(value) === true).map(([label]) => label);
}

function safeString(value: HarnessSafeValue | undefined): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    return trimmed.length > MAX_SAFE_TEXT_LENGTH ? `${trimmed.slice(0, MAX_SAFE_TEXT_LENGTH - 3)}...` : trimmed;
  }
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return null;
}

function firstSafeString(...values: Array<HarnessSafeValue | undefined>) {
  for (const value of values) {
    const safe = safeString(value);
    if (safe) return safe;
  }
  return null;
}

function safeStringArray(values: string[] | undefined) {
  return (values ?? []).map((value) => safeString(value) ?? "").filter(Boolean).slice(0, 8);
}

function safeBoolean(value: HarnessSafeValue | undefined): boolean | null {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["yes", "true", "1", "pass", "passed"].includes(normalized)) return true;
    if (["no", "false", "0", "none", "fail", "failed"].includes(normalized)) return false;
  }
  return null;
}

function safeNumber(value: HarnessSafeValue | undefined): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function safeUrl(value: HarnessSafeValue | undefined): string | null {
  const text = safeString(value);
  if (!text) return null;
  try {
    const url = new URL(text);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    if (url.hostname !== "harness.slimyai.xyz") return null;
    if (!url.pathname.startsWith("/reports")) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function isManualQaPending(status: string | null) {
  if (!status) return true;
  const normalized = status.toLowerCase();
  return !["pass", "passed", "accepted", "complete", "completed", "none", "not_required"].includes(normalized);
}

function hasAny(result: string | null, status: string | null, needles: string[]) {
  const text = [result, status].filter(Boolean).join(" ").toLowerCase();
  return needles.some((needle) => text.includes(needle));
}

function minutesSince(value: string | null, now: Date) {
  if (!value) return null;
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.max(0, Math.floor((now.getTime() - parsed) / 60000));
}

function formatSchemaMessage(error: ZodError) {
  const first = error.issues[0];
  if (!first) return "Live harness session index schema does not match harness-session-index/v1.";
  return `Live harness session index schema mismatch at ${first.path.join(".") || "root"}: ${first.message}`;
}
