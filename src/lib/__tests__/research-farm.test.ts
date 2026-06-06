import { describe, expect, it } from "vitest";
import {
  validateArtifactPath,
  getContentType,
  bucketFromStatus,
  computeResearchStats,
  findItemByRunId,
  type ResearchIndexItem,
} from "../research-farm";

describe("validateArtifactPath", () => {
  it("rejects empty path", () => {
    expect(validateArtifactPath("").valid).toBe(false);
  });

  it("rejects absolute path", () => {
    expect(validateArtifactPath("/etc/passwd").valid).toBe(false);
  });

  it("rejects path traversal", () => {
    expect(validateArtifactPath("../../etc/passwd").valid).toBe(false);
    expect(validateArtifactPath("foo/../../../etc/passwd").valid).toBe(false);
  });

  it("rejects disallowed extensions", () => {
    expect(validateArtifactPath("runs/test/run.sh").valid).toBe(false);
    expect(validateArtifactPath("runs/test/run.exe").valid).toBe(false);
    expect(validateArtifactPath("runs/test/run.php").valid).toBe(false);
  });

  it("allows allowed extensions", () => {
    expect(validateArtifactPath("runs/test/report.md").valid).toBe(true);
    expect(validateArtifactPath("runs/test/almanac.html").valid).toBe(true);
    expect(validateArtifactPath("runs/test/presentation.pdf").valid).toBe(true);
    expect(validateArtifactPath("runs/test/sources.jsonl").valid).toBe(true);
    expect(validateArtifactPath("runs/test/citations.json").valid).toBe(true);
    expect(validateArtifactPath("runs/test/run.json").valid).toBe(true);
    expect(validateArtifactPath("runs/test/notes.txt").valid).toBe(true);
  });

  it("resolved path stays under research root", () => {
    const result = validateArtifactPath("runs/2026-06-06-sample/report.md");
    expect(result.valid).toBe(true);
    expect(result.resolvedPath).toContain("research/runs/2026-06-06-sample/report.md");
  });
});

describe("getContentType", () => {
  it("returns correct content types", () => {
    expect(getContentType("test.html")).toBe("text/html; charset=utf-8");
    expect(getContentType("test.pdf")).toBe("application/pdf");
    expect(getContentType("test.md")).toBe("text/markdown; charset=utf-8");
    expect(getContentType("test.json")).toBe("application/json");
    expect(getContentType("test.jsonl")).toBe("application/x-ndjson");
    expect(getContentType("test.txt")).toBe("text/plain; charset=utf-8");
  });
});

describe("bucketFromStatus", () => {
  it("maps known statuses", () => {
    expect(bucketFromStatus("queued")).toBe("queued");
    expect(bucketFromStatus("running")).toBe("running");
    expect(bucketFromStatus("complete")).toBe("complete");
    expect(bucketFromStatus("planned")).toBe("planned");
  });

  it("maps unknown to unknown", () => {
    expect(bucketFromStatus("unknown_status")).toBe("unknown");
  });
});

describe("computeResearchStats", () => {
  it("computes stats from items", () => {
    const items: ResearchIndexItem[] = [
      {
        immutable_run_id: "run-1", slug: "run-1", title: "Test 1",
        status: "queued", priority: "normal", depth: "deep",
        confidence: null, source_count: 0, citation_count: 0,
        created_at: "2026-06-01", started_at: null, completed_at: null,
        model_used: null, runner_version: null,
        pdf_path: null, report_path: null, critic_path: null,
        proof_path: null, topic_path: null,
        tags: [], related_harness_session: null, related_guild_campaign: null,
        assigned_critter: null,
      },
      {
        immutable_run_id: "run-2", slug: "run-2", title: "Test 2",
        status: "complete", priority: "high", depth: "deep",
        confidence: "high", source_count: 5, citation_count: 3,
        created_at: "2026-06-01", started_at: "2026-06-02", completed_at: "2026-06-03",
        model_used: "test", runner_version: "1.0",
        pdf_path: "runs/run-2/presentation.pdf", report_path: null, critic_path: null,
        proof_path: null, topic_path: null,
        tags: ["test"], related_harness_session: null, related_guild_campaign: null,
        assigned_critter: null,
      },
    ];

    const stats = computeResearchStats(items);
    expect(stats.total).toBe(2);
    expect(stats.queued).toBe(1);
    expect(stats.complete).toBe(1);
    expect(stats.running).toBe(0);
    expect(stats.planned).toBe(0);
    expect(stats.almanacsAvailable).toBe(1);
  });

  it("returns zeros for empty array", () => {
    const stats = computeResearchStats([]);
    expect(stats.total).toBe(0);
    expect(stats.queued).toBe(0);
    expect(stats.almanacsAvailable).toBe(0);
  });
});

describe("findItemByRunId", () => {
  it("finds matching item", () => {
    const items: ResearchIndexItem[] = [
      {
        immutable_run_id: "2026-06-06-sample", slug: "sample", title: "Sample",
        status: "planned", priority: "normal", depth: "deep",
        confidence: null, source_count: 0, citation_count: 0,
        created_at: null, started_at: null, completed_at: null,
        model_used: null, runner_version: null,
        pdf_path: null, report_path: null, critic_path: null,
        proof_path: null, topic_path: null,
        tags: [], related_harness_session: null, related_guild_campaign: null,
        assigned_critter: null,
      },
    ];
    expect(findItemByRunId(items, "2026-06-06-sample")).toBe(items[0]);
  });

  it("returns null for missing run", () => {
    expect(findItemByRunId([], "nonexistent")).toBeNull();
  });
});
