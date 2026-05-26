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
});
