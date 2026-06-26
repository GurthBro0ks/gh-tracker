import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { loadHarnessSessionIndex, MISSION_CONTROL_REPORTS_URL } from "../harness-session-index";

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
    source_machine: "slimy-nuc2",
    sessions: [
      {
        session_id: "session-older",
        result: "PASS",
        status: "accepted",
        project: "older-project",
        feature_id: "older-feature",
        timestamp: "2026-06-12T10:00:00Z",
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
        timestamp: "2026-06-13T10:00:00Z",
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
      expect(view.summary.warnCount).toBe(1);
      expect(view.summary.blockedCount).toBe(1);
      expect(view.latestSessions[0].id).toBe("session-newer");
      expect(view.latestSessions[0].reportUrl).toBe("https://harness.slimyai.xyz/reports/sessions/newer.json");
      expect(view.latestSessions[1].reportUrl).toBe(`${MISSION_CONTROL_REPORTS_URL}/sessions/older.json`);
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
});
