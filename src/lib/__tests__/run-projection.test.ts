import { afterEach, describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "fs";
import { mkdtemp, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join, resolve } from "path";
import {
  RUN_PROJECTION_ROOT,
  RunProjectionValidationError,
  deriveRunProjectionFreshness,
  loadRunProjection,
  parseRunProjection,
  parseRunProjectionJson,
} from "../run-projection";
import {
  RUN_PROJECTION_FIXTURES,
  activeRunProjectionFixture,
  cloneRunProjectionFixture,
  completedWithContinuationRunProjectionFixture,
  fixtureFlaggedRunProjectionFixture,
} from "../run-projection-fixtures";


const repoRoot = resolve(__dirname, "../../..");
const harnessFixtureRoot = "/home/slimy/slimy-harness/ops/tests/fixtures/run-projections";
const goodFixtureNames = [
  "active",
  "completed_owner_qa_pending",
  "superseded",
  "fixture_flagged",
  "completed_with_continuation",
] as const;
const tempDirs: string[] = [];

function fixtureRaw(name: string): string {
  return readFileSync(join(harnessFixtureRoot, `${name}.json`), "utf8");
}

async function makeTempRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "run-projection-rw0-"));
  tempDirs.push(root);
  return root;
}

async function writeProjection(root: string, runId: string, contents: string): Promise<void> {
  await writeFile(join(root, `${runId}.json`), contents, "utf8");
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("run-projection.v1 schema and fixtures", () => {
  it.each(goodFixtureNames)("loads the %s fixture and matches its TypeScript copy", (name) => {
    const parsed = parseRunProjectionJson(fixtureRaw(name));
    expect(parsed).toEqual(RUN_PROJECTION_FIXTURES[name]);
    expect(parsed.generated_by).toBe("rw0-fixture");
  });

  it("refuses corrupt fixture JSON without exposing raw content", () => {
    try {
      parseRunProjectionJson(fixtureRaw("corrupt"));
      throw new Error("corrupt fixture unexpectedly parsed");
    } catch (error) {
      expect(error).toBeInstanceOf(RunProjectionValidationError);
      expect((error as RunProjectionValidationError).errorClass).toBe("invalid_json");
      expect((error as Error).message).not.toContain("synthetic_note");
    }
  });

  it("refuses wrong and unknown schema versions", () => {
    expect(() => parseRunProjectionJson(fixtureRaw("wrong_version"))).toThrowError(
      expect.objectContaining({ errorClass: "unsupported_schema_version" }),
    );
    const unknown = { ...activeRunProjectionFixture, schema_version: "run-projection.v999" };
    expect(() => parseRunProjection(unknown)).toThrowError(
      expect.objectContaining({ errorClass: "unsupported_schema_version" }),
    );
  });

  it("strictly refuses additional fields", () => {
    const projection = cloneRunProjectionFixture("active") as unknown as Record<string, unknown>;
    projection.invented_truth = "not allowed";
    expect(() => parseRunProjection(projection)).toThrowError(
      expect.objectContaining({ errorClass: "schema_mismatch" }),
    );
  });

  it("refuses missing required fields", () => {
    const projection = cloneRunProjectionFixture("active") as unknown as Record<string, unknown>;
    delete projection.flags;
    expect(() => parseRunProjection(projection)).toThrowError(
      expect.objectContaining({ errorClass: "schema_mismatch" }),
    );
  });

  it("passes UNKNOWN through without coercion", () => {
    const parsed = parseRunProjection(fixtureFlaggedRunProjectionFixture);
    expect(parsed.state.evidence).toBe("UNKNOWN");
    expect(parsed.state.review).toBe("UNKNOWN");
    expect(parsed.state.acceptance).toBe("UNKNOWN");
    expect(parsed.state.owner_action).toBe("UNKNOWN");
    expect(parsed.state.notification).toBe("UNKNOWN");
  });

  it("preserves fixture-only and production-disabled flags", () => {
    for (const fixture of Object.values(RUN_PROJECTION_FIXTURES)) {
      const parsed = parseRunProjection(fixture);
      expect(parsed.flags.test_fixture_only).toBe(true);
      expect(parsed.flags.production_acceptance_enabled).toBe(false);
      expect(parsed.flags.production_storage_active).toBe(false);
    }
  });

  it("loads the synthetic continuation safely with non-transitive authorization", () => {
    const parsed = parseRunProjection(completedWithContinuationRunProjectionFixture);
    expect(parsed.continuation).not.toBeNull();
    expect(parsed.continuation?.push_authorized).toBe(false);
    expect(parsed.continuation?.deploy_authorized).toBe(false);
    expect(parsed.continuation?.restart_authorized).toBe(false);
    expect(parsed.continuation?.handoff_complete).toBe(false);
    expect(parsed.continuation?.prohibited_actions.join(" ").toLowerCase()).toContain(
      "not transitive",
    );
  });
});

describe("reader-side staleness", () => {
  const generatedAt = "2026-07-14T10:00:00.000Z";
  const generatedAtMs = Date.parse(generatedAt);

  it("is fresh just under ten minutes", () => {
    expect(
      deriveRunProjectionFreshness(generatedAt, "ACTIVE", generatedAtMs + 10 * 60 * 1000 - 1),
    ).toEqual({ freshness: "fresh", freshnessLabel: "fresh", terminal: false });
  });

  it("is stale at exactly ten minutes", () => {
    expect(
      deriveRunProjectionFreshness(generatedAt, "ACTIVE", generatedAtMs + 10 * 60 * 1000),
    ).toEqual({ freshness: "stale", freshnessLabel: "stale", terminal: false });
  });

  it("is stale just under twenty-four hours", () => {
    expect(
      deriveRunProjectionFreshness(generatedAt, "ACTIVE", generatedAtMs + 24 * 60 * 60 * 1000 - 1),
    ).toEqual({ freshness: "stale", freshnessLabel: "stale", terminal: false });
  });

  it("is old at exactly twenty-four hours", () => {
    expect(
      deriveRunProjectionFreshness(generatedAt, "ACTIVE", generatedAtMs + 24 * 60 * 60 * 1000),
    ).toEqual({ freshness: "old", freshnessLabel: "old", terminal: false });
  });

  it("labels old terminal states final but leaves INTERRUPTED non-terminal", () => {
    expect(
      deriveRunProjectionFreshness(generatedAt, "COMPLETED", generatedAtMs + 25 * 60 * 60 * 1000),
    ).toEqual({ freshness: "old", freshnessLabel: "final", terminal: true });
    expect(
      deriveRunProjectionFreshness(generatedAt, "INTERRUPTED", generatedAtMs + 25 * 60 * 60 * 1000),
    ).toEqual({ freshness: "old", freshnessLabel: "old", terminal: false });
  });
});

describe("read-only loader", () => {
  it.each(goodFixtureNames)("loads %s from an explicitly isolated root", async (name) => {
    const root = await makeTempRoot();
    const fixture = RUN_PROJECTION_FIXTURES[name];
    await writeProjection(root, fixture.run.run_id, fixtureRaw(name));

    const result = await loadRunProjection(fixture.run.run_id, {
      rootPath: root,
      nowMs: Date.parse(fixture.generated_at) + 30_000,
    });

    expect(result.mode).toBe("snapshot");
    expect(result.projectionState).toBe("valid");
    expect(result.data).toEqual(fixture);
  });

  it("uses explicit fixture fallback only for a missing projection", async () => {
    const root = await makeTempRoot();
    const result = await loadRunProjection(activeRunProjectionFixture.run.run_id, {
      rootPath: root,
      fixtureFallback: activeRunProjectionFixture,
      nowMs: Date.parse(activeRunProjectionFixture.generated_at) + 30_000,
    });

    expect(result.mode).toBe("fixture");
    expect(result.projectionState).toBe("missing");
    expect(result.errorClass).toBe("missing_path");
    expect(result.data).toEqual(activeRunProjectionFixture);
  });

  it("refuses corrupt input instead of hiding it behind fixture fallback", async () => {
    const root = await makeTempRoot();
    const runId = activeRunProjectionFixture.run.run_id;
    await writeProjection(root, runId, fixtureRaw("corrupt"));
    const result = await loadRunProjection(runId, {
      rootPath: root,
      fixtureFallback: activeRunProjectionFixture,
    });

    expect(result.mode).toBe("snapshot");
    expect(result.projectionState).toBe("invalid");
    expect(result.errorClass).toBe("invalid_json");
    expect(result.data).toBeNull();
  });

  it("refuses wrong-version input through the file loader", async () => {
    const root = await makeTempRoot();
    const wrongVersion = JSON.parse(fixtureRaw("wrong_version")) as { run: { run_id: string } };
    await writeProjection(root, wrongVersion.run.run_id, fixtureRaw("wrong_version"));
    const result = await loadRunProjection(wrongVersion.run.run_id, { rootPath: root });

    expect(result.projectionState).toBe("invalid");
    expect(result.errorClass).toBe("unsupported_schema_version");
    expect(result.data).toBeNull();
  });

  it("rejects a malformed run ID before any filesystem read", async () => {
    const productionRootExisted = existsSync(RUN_PROJECTION_ROOT);
    const result = await loadRunProjection("../../not-a-run-id");
    expect(result.errorClass).toBe("invalid_run_id");
    expect(existsSync(RUN_PROJECTION_ROOT)).toBe(productionRootExisted);
  });

  it("does not create or read the production root in RW-0 tests", async () => {
    expect(RUN_PROJECTION_ROOT).toBe("/home/slimy/harness-logs/run-projections/");
    expect(existsSync(RUN_PROJECTION_ROOT)).toBe(false);
    const root = await makeTempRoot();
    const result = await loadRunProjection(activeRunProjectionFixture.run.run_id, {
      rootPath: root,
      fixtureFallback: activeRunProjectionFixture,
    });
    expect(result.mode).toBe("fixture");
    expect(existsSync(RUN_PROJECTION_ROOT)).toBe(false);
  });

  it("has no route usage, deep validator call, network path, or notification path", () => {
    const source = readFileSync(join(repoRoot, "src/lib/run-projection.ts"), "utf8");
    const fixtureSource = readFileSync(join(repoRoot, "src/lib/run-projection-fixtures.ts"), "utf8");
    expect(existsSync(join(repoRoot, "src/app/runs"))).toBe(false);
    for (const forbidden of [
      "acceptance-ledger current",
      "acceptance_ledger",
      "fetch(",
      "http.request",
      "https.request",
      "notify-proof-dir-complete",
      "notify-session-complete",
    ]) {
      expect(source).not.toContain(forbidden);
      expect(fixtureSource).not.toContain(forbidden);
    }
  });
});
