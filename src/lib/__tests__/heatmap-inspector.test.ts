import { describe, expect, it } from "vitest";
import { buildHeatmapInspectorCells } from "../heatmap-inspector";

describe("heatmap inspector", () => {
  it("maps heatmap cells with trend-backed details when available", () => {
    const cells = buildHeatmapInspectorCells(
      [[1, 2]],
      [{ day: "May 09", total: 5, laptop: 2, nuc1: 1, nuc2: 2 }],
      [{ repoId: "gh-tracker", timestamp: "2026-05-09T10:00:00Z" }],
    );

    expect(cells).toHaveLength(2);
    expect(cells[0].detailsAvailable).toBe(false);
    expect(cells[1].detailsAvailable).toBe(true);
    expect(cells[1].dateLabel).toBe("May 09");
    expect(cells[1].commitCount).toBe(5);
    expect(cells[1].machineSummary).toContain("Laptop 2");
    expect(cells[1].repoSummary).toContain("1 events across 1 repos");
  });

  it("does not fabricate repo summary when timeline match is missing", () => {
    const cells = buildHeatmapInspectorCells(
      [[3]],
      [{ day: "05-10", total: 0, laptop: 0, nuc1: 0, nuc2: 0 }],
      [],
    );

    expect(cells[0].detailsAvailable).toBe(true);
    expect(cells[0].repoSummary).toBeNull();
    expect(cells[0].machineSummary).toBeNull();
  });
});
