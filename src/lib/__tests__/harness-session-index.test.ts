import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import HarnessDashboard from "../../components/harness-dashboard";
import {
  loadHarnessSessionIndex,
  REPORTS_SSO_BRIDGE_PATH,
  toReportsSsoBridgeUrl,
} from "../harness-session-index";

const now = new Date("2026-06-13T12:00:00Z");

function withTempIndex(data: unknown, run: (path: string) => Promise<void>) {
  const dir = mkdtempSync(join(tmpdir(), "gh-tracker-harness-index-"));
  const path = join(dir, "harness-session-index.json");
  writeFileSync(path, typeof data === "string" ? data : JSON.stringify(data, null, 2));
  return run(path).finally(() => rmSync(dir, { recursive: true, force: true }));
}

function makeIndex(overrides: Record<string, unknown> = {}) {
  return {
    schema_version: "harness-session-index/v1",
    generated_at: "2026-06-13T11:34:01Z",
    generated_by: "sequencer/export-session-index.sh",
    source_machine: "slimy-nuc2",
    session_count: 2,
    sessions: [
      {
        session_id: "session-older",
        result: "PASS",
        status: "accepted",
        project: "older-project",
        feature_id: "older-feature",
        timestamp: "2026-06-12T10:00:00Z",
        created_at: "2026-06-12T10:00:00Z",
        source_report: "older.json",
        report_url: null,
        proof_dir: "/tmp/proof_older",
        warnings: [],
        failures: [],
        manual_qa_status: "accepted",
      },
      {
        session_id: "session-newer",
        result: "WARN",
        status: "blocked",
        project: "newer-project",
        feature_id: "newer-feature",
        timestamp: "2026-06-13T09:00:00Z",
        created_at: "2026-06-13T10:00:00Z",
        source_report: "newer.json",
        report_url: "https://harness.slimyai.xyz/reports/sessions/newer.json",
        proof_dir: "/tmp/proof_newer",
        warnings: ["manual QA pending"],
        failures: [],
        manual_qa_status: "pending",
        caddy_changed: false,
      },
    ],
    ...overrides,
  };
}

describe("harness session index loader", () => {
  it("loads valid safe metadata and sorts newest sessions first", async () => {
    await withTempIndex(makeIndex(), async (path) => {
      const view = await loadHarnessSessionIndex(path, now);
      expect(view.status).toBe("ready");
      expect(view.summary.totalSessions).toBe(2);
      expect(view.declaredSessionCount).toBe(2);
      expect(view.schemaVersion).toBe("harness-session-index/v1");
      expect(view.generatedAt).toBe("2026-06-13T11:34:01Z");
      expect(view.generatedBy).toBe("sequencer/export-session-index.sh");
      expect(view.summary.warnCount).toBe(1);
      expect(view.summary.blockedCount).toBe(1);
      expect(view.latestSessions[0].id).toBe("session-newer");
      expect(view.latestSessions[0].timestamp).toBe("2026-06-13T10:00:00Z");
      expect(view.maxSessionTimestamp).toBe("2026-06-13T10:00:00Z");
      expect(view.maxSessionAgeMinutes).toBe(120);
      expect(view.summary.reportLinkCount).toBe(2);
      expect(view.canonicalReportsUrl).toBe(`${REPORTS_SSO_BRIDGE_PATH}?returnTo=https%3A%2F%2Fharness.slimyai.xyz%2Freports`);
      expect(view.canonicalSessionsUrl).toBe(`${REPORTS_SSO_BRIDGE_PATH}?returnTo=https%3A%2F%2Fharness.slimyai.xyz%2Freports%2Fsessions`);
      expect(view.latestSessions[0].reportUrl).toBe(`${REPORTS_SSO_BRIDGE_PATH}?returnTo=https%3A%2F%2Fharness.slimyai.xyz%2Freports%2Fsessions%2Fnewer.json`);
      expect(view.latestSessions[1].reportUrl).toBe(`${REPORTS_SSO_BRIDGE_PATH}?returnTo=https%3A%2F%2Fharness.slimyai.xyz%2Freports%2Fsessions%2Folder.json`);
    });
  });

  it("returns a safe missing state when the live index file does not exist", async () => {
    const view = await loadHarnessSessionIndex("/tmp/gh-tracker-missing-harness-index.json", now);
    expect(view.status).toBe("missing");
    expect(view.sessions).toEqual([]);
  });

  it("returns invalid_json for malformed JSON", async () => {
    await withTempIndex("{not json", async (path) => {
      const view = await loadHarnessSessionIndex(path, now);
      expect(view.status).toBe("invalid_json");
    });
  });

  it("returns schema_mismatch for an unexpected schema version", async () => {
    await withTempIndex(makeIndex({ schema_version: "wrong" }), async (path) => {
      const view = await loadHarnessSessionIndex(path, now);
      expect(view.status).toBe("schema_mismatch");
    });
  });

  it("marks old indexes stale without rejecting the safe metadata", async () => {
    await withTempIndex(makeIndex({ generated_at: "2026-06-10T00:00:00Z" }), async (path) => {
      const view = await loadHarnessSessionIndex(path, now);
      expect(view.status).toBe("ready");
      expect(view.isStale).toBe(true);
    });
  });

  it("keeps older indexes readable when generated freshness metadata is absent", async () => {
    await withTempIndex({
      sessions: [
        {
          session_id: "legacy-session",
          project: "legacy-project",
          timestamp: "2026-06-13T09:30:00Z",
          source_report: "legacy.json",
          warnings: [],
          failures: [],
        },
      ],
    }, async (path) => {
      const view = await loadHarnessSessionIndex(path, now);
      expect(view.status).toBe("ready");
      expect(view.schemaVersion).toBeNull();
      expect(view.generatedAt).toBeNull();
      expect(view.generatedBy).toBeNull();
      expect(view.maxSessionTimestamp).toBe("2026-06-13T09:30:00Z");
      expect(view.message).toContain("generated freshness is unknown");
    });
  });

  it("renders generated and session freshness without execution controls", async () => {
    await withTempIndex(makeIndex(), async (path) => {
      const view = await loadHarnessSessionIndex(path, now);
      const markup = renderToStaticMarkup(HarnessDashboard({ index: view, session: { email: "owner@example.com", role: "owner" } }));
      expect(markup).toContain("Generated by");
      expect(markup).toContain("Latest session");
      expect(markup).toContain("sequencer/export-session-index.sh");
      expect(markup).toContain("generated fresh enough");
      expect(markup).toContain("Session index");
      expect(markup).toContain("returnTo=https%3A%2F%2Fharness.slimyai.xyz%2Freports%2Fsessions");
      expect(markup).toContain("read-only metadata");
      expect(markup).toContain("Execution buttons");
      expect(markup).toContain("absent");
      expect(markup).not.toMatch(/\b(Run|Execute|Restart|Deploy)\b/);
    });
  });

  it("builds report links through the owner-gated SSO bridge", () => {
    expect(toReportsSsoBridgeUrl("https://harness.slimyai.xyz/reports/sessions/example.json")).toBe(
      `${REPORTS_SSO_BRIDGE_PATH}?returnTo=https%3A%2F%2Fharness.slimyai.xyz%2Freports%2Fsessions%2Fexample.json`,
    );
    expect(toReportsSsoBridgeUrl("https://evil.example/reports/sessions/example.json")).toBe(
      `${REPORTS_SSO_BRIDGE_PATH}?returnTo=https%3A%2F%2Fharness.slimyai.xyz%2Freports`,
    );
  });
});
