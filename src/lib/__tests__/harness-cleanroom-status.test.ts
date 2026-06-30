import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadHarnessCleanroomStatus } from "../harness-cleanroom-status";

function withTempFiles(run: (paths: { proofIndexPath: string; goalRecordPath: string }) => Promise<void>) {
  const dir = mkdtempSync(join(tmpdir(), "gh-tracker-cleanroom-status-"));
  const paths = {
    proofIndexPath: join(dir, "proof-index.json"),
    goalRecordPath: join(dir, "goal-records.jsonl"),
  };
  return run(paths).finally(() => rmSync(dir, { recursive: true, force: true }));
}

describe("harness clean-room status loader", () => {
  it("loads generated proof index and active goal records", async () => {
    await withTempFiles(async (paths) => {
      writeFileSync(paths.proofIndexPath, JSON.stringify({
        schema_version: "slimy-proof-index/v1",
        generated_at: "2026-06-29T20:00:00Z",
        proof_roots: ["/tmp"],
        proof_count: 1,
        proofs: [{
          id: "proof_agnt_cleanroom",
          phase: "agnt-cleanroom-first-slice-proof-goal-habitat",
          result: "WARN",
          target_machine: "NUC2",
          target_repo: "/home/slimy/slimy-harness;/opt/slimy/gh-tracker",
          proof_dir: "/tmp/proof_agnt_cleanroom",
          validation_summary: "manual QA pending",
          manual_qa_status: "pending_owner_qa",
          discord_status: "no",
          report_url: "https://harness.slimyai.xyz/reports/sessions/example.json",
          changed_files: ["sequencer/trace-store.py"],
          commit_sha: "abc123",
          pushed: false,
          risk_flags: ["warn_result"],
          result_file_present: true,
          result_file_partial: false,
          updated_at: "2026-06-29T20:01:00Z",
        }],
      }));
      writeFileSync(paths.goalRecordPath, JSON.stringify({
        schema_version: "slimy-goal-record/v1",
        timestamp: "2026-06-29T20:02:00Z",
        goal_id: "agnt-cleanroom-first-slice",
        phase: "agnt-cleanroom-first-slice-proof-goal-habitat",
        state: "running",
        reason: "implementation in progress",
        target_machine: "NUC2",
        target_repo: "/home/slimy/slimy-harness;/opt/slimy/gh-tracker",
        proof_dir: "/tmp/proof_agnt_cleanroom",
        manual_qa_status: "pending_owner_qa",
        blocker: null,
        report_url: null,
      }) + "\n");

      const view = await loadHarnessCleanroomStatus(paths);
      expect(view.proofIndex.status).toBe("ready");
      expect(view.proofIndex.latestProof?.result).toBe("WARN");
      expect(view.proofIndex.latestProof?.isManualQaPending).toBe(true);
      expect(view.goalRecord.status).toBe("ready");
      expect(view.goalRecord.activeGoal?.state).toBe("running");
      expect(view.goalRecord.activeGoal?.reason).toBe("implementation in progress");
    });
  });

  it("returns safe missing states when generated files do not exist", async () => {
    const view = await loadHarnessCleanroomStatus({
      proofIndexPath: "/tmp/missing-cleanroom-proof-index.json",
      goalRecordPath: "/tmp/missing-cleanroom-goal-record.jsonl",
    });
    expect(view.proofIndex.status).toBe("missing");
    expect(view.goalRecord.status).toBe("missing");
  });

  it("rejects goal records that try to carry passes claims", async () => {
    await withTempFiles(async (paths) => {
      writeFileSync(paths.proofIndexPath, JSON.stringify({
        schema_version: "slimy-proof-index/v1",
        generated_at: "2026-06-29T20:00:00Z",
        proof_roots: [],
        proof_count: 0,
        proofs: [],
      }));
      writeFileSync(paths.goalRecordPath, JSON.stringify({
        schema_version: "slimy-goal-record/v1",
        timestamp: "2026-06-29T20:02:00Z",
        goal_id: "bad",
        state: "running",
        reason: "bad",
        passes: true,
      }) + "\n");

      const view = await loadHarnessCleanroomStatus(paths);
      expect(view.goalRecord.status).toBe("schema_mismatch");
      expect(view.goalRecord.message).toContain("passes");
    });
  });
});
