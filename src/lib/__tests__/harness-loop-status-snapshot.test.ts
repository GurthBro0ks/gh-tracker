import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, rm, writeFile } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { loadHabitatLoopStatusSnapshot } from "../harness-loop-status-snapshot";

const tempDirs: string[] = [];

async function makeTempFile(contents: string) {
  const dir = await mkdtemp(join(tmpdir(), "habitat-loop-status-snapshot-"));
  tempDirs.push(dir);
  const filePath = join(dir, "latest.json");
  await writeFile(filePath, contents, "utf8");
  return filePath;
}

function makeItem(overrides: Record<string, unknown> = {}) {
  return {
    id: "item-1",
    phase: "sample-phase",
    title: "Sample item",
    target_machine: "NUC1",
    target_repo: "/opt/slimy/gh-tracker",
    model_recommendation: "Claude",
    glm_thinking_level: "high",
    status: "OK",
    safety_level: "low",
    proof_dir: "proof_sample",
    proof_gate_verdict: "PASS_ELIGIBLE",
    manual_qa_status: "pending",
    next_required_gate: "owner manual QA",
    blocked_reason: "",
    updated_at: new Date().toISOString(),
    warnings_count: 0,
    reasons_count: 0,
    ...overrides,
  };
}

function makeSnapshot(overrides: Record<string, unknown> = {}) {
  return {
    schema_version: "loop-status.v1",
    generated_at: new Date(Date.now() - 30_000).toISOString(),
    generator: "slimy-harness.loop_status_exporter",
    source: {
      queue_path: "/home/slimy/slimy-harness/queue.json",
      proof_root: "/home/slimy/proofs",
    },
    summary: {
      total_items: 1,
      by_status: { OK: 1, WARN: 0, BLOCKED: 0, FAIL: 0, UNKNOWN: 0 },
      by_gate: { PASS_ELIGIBLE: 1 },
      highest_risk_state: "OK",
      has_blockers: false,
      has_failures: false,
      stale_count: 0,
    },
    items: [makeItem()],
    safety: {
      shell_execution_present: false,
      mutation_controls_present: false,
      request_time_shell_required: false,
      secrets_redacted: true,
      owner_gate_required_for_ui: true,
    },
    errors: [],
    warnings: [],
    ...overrides,
  };
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("loadHabitatLoopStatusSnapshot", () => {
  it("returns snapshot mode for a valid snapshot and projects only allow-listed fields", async () => {
    const filePath = await makeTempFile(JSON.stringify(makeSnapshot()));
    const result = await loadHabitatLoopStatusSnapshot(filePath);

    expect(result.mode).toBe("snapshot");
    expect(result.snapshotState).toBe("fresh");
    expect(result.stateLabel).toBe("SNAPSHOT MODE");
    expect(result.data.summary.totalItems).toBe(1);
    expect(result.data.items).toHaveLength(1);
    expect(result.data.items[0]).toEqual({
      phase: "sample-phase",
      title: "Sample item",
      status: "OK",
      proofGateVerdict: "PASS_ELIGIBLE",
      manualQaStatus: "pending",
      nextRequiredGate: "owner manual QA",
      blockedReason: "",
      updatedAt: expect.any(String),
    });
    // Disallowed raw fields must never appear anywhere in the projected item.
    expect(JSON.stringify(result.data.items[0])).not.toContain("target_machine");
    expect(JSON.stringify(result.data.items[0])).not.toContain("proof_dir");
    expect(JSON.stringify(result.data.items[0])).not.toContain("proof_sample");
    expect(JSON.stringify(result.data.items[0])).not.toContain("NUC1");
    expect(JSON.stringify(result.data.items[0])).not.toContain("Claude");
  });

  it("falls back safely when the snapshot is missing", async () => {
    const result = await loadHabitatLoopStatusSnapshot("/tmp/does-not-exist-habitat-loop-status-snapshot.json");

    expect(result.mode).toBe("fixture");
    expect(result.snapshotState).toBe("missing");
    expect(result.stateLabel).toBe("SNAPSHOT MISSING");
  });

  it("marks a valid but old snapshot as stale", async () => {
    const filePath = await makeTempFile(JSON.stringify(makeSnapshot({
      generated_at: new Date(Date.now() - 3_600_000).toISOString(),
    })));
    const result = await loadHabitatLoopStatusSnapshot(filePath);

    expect(result.mode).toBe("snapshot");
    expect(result.snapshotState).toBe("stale");
    expect(result.stateLabel).toBe("STALE SNAPSHOT");
  });

  it("fails safe for invalid snapshot JSON", async () => {
    const filePath = await makeTempFile("{not valid json");
    const result = await loadHabitatLoopStatusSnapshot(filePath);

    expect(result.mode).toBe("fixture");
    expect(result.snapshotState).toBe("invalid");
    expect(result.stateLabel).toBe("SNAPSHOT INVALID");
  });

  it("fails safe when the schema does not validate", async () => {
    const filePath = await makeTempFile(JSON.stringify({ not: "a valid snapshot" }));
    const result = await loadHabitatLoopStatusSnapshot(filePath);

    expect(result.mode).toBe("fixture");
    expect(result.snapshotState).toBe("invalid");
    expect(result.stateLabel).toBe("SNAPSHOT INVALID");
  });

  it("fails safe when declared safety flags indicate an unsafe/untrusted producer", async () => {
    const filePath = await makeTempFile(JSON.stringify(makeSnapshot({
      safety: {
        shell_execution_present: true,
        mutation_controls_present: false,
        request_time_shell_required: false,
        secrets_redacted: true,
        owner_gate_required_for_ui: true,
      },
    })));
    const result = await loadHabitatLoopStatusSnapshot(filePath);

    expect(result.mode).toBe("fixture");
    expect(result.snapshotState).toBe("invalid");
  });

  it("fails safe on schema_version mismatch", async () => {
    const filePath = await makeTempFile(JSON.stringify(makeSnapshot({ schema_version: "loop-status.v2" })));
    const result = await loadHabitatLoopStatusSnapshot(filePath);

    expect(result.mode).toBe("fixture");
    expect(result.snapshotState).toBe("invalid");
  });
});
