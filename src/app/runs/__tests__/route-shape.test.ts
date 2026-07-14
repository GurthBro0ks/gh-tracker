import { readdirSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import { describe, expect, it } from "vitest";

const runsRoot = resolve(process.cwd(), "src/app/runs");

function walk(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? walk(path) : [relative(runsRoot, path).split(sep).join("/")];
  });
}

describe("Run Workspace route tree", () => {
  it("contains exactly the index and one detail page with no route handlers", () => {
    const files = walk(runsRoot).sort();
    const pages = files.filter((file) => file.endsWith("page.tsx"));
    const routeHandlers = files.filter((file) => file.endsWith("route.ts"));
    const dynamicSegments = [
      ...new Set(files.flatMap((file) => file.split("/").filter((part) => /^\[.+\]$/.test(part)))),
    ].sort();

    expect(pages).toEqual(["[runId]/page.tsx", "page.tsx"]);
    expect(routeHandlers).toEqual([]);
    expect(dynamicSegments).toEqual(["[runId]"]);
    expect(files.some((file) => /(^|\/)(api|actions?|history|timeline|decisions?)(\/|$)/i.test(file))).toBe(false);
  });
});
