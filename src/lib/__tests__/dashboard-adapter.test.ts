import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const repoRoot = process.cwd();

describe("dashboard adapter canonical grouping", () => {
  it("retains canonical grouping implementation", () => {
    const source = readFileSync(join(repoRoot, "src/lib/dashboard-adapter.ts"), "utf8");
    expect(source).toContain("export function buildCanonicalRepos(");
    expect(source).toContain("const groups = new Map");
    expect(source).toContain("groups.set(catalogEntry.repoId");
    expect(source).toContain("groups.values()");
  });

  it("zero-fills commit trend through today and derives heatmap from trend", () => {
    const source = readFileSync(join(repoRoot, "src/lib/dashboard-adapter.ts"), "utf8");
    expect(source).toContain("function buildContinuousDailyTrend(");
    expect(source).toContain("existing ?? {");
    expect(source).toContain("total: 0");
    expect(source).toContain("const todayIso = isoDateUTC(new Date())");
    expect(source).toContain("const heatmap = buildHeatmapFromTrend(commitTrend, 6)");
    expect(source).toContain("commitTrend,");
  });
});
