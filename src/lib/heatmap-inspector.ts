type HeatmapTrendRow = {
  day: string;
  total: number;
  laptop: number;
  nuc1: number;
  nuc2: number;
};

type HeatmapTimelineRow = {
  repoId: string;
  timestamp: string;
};

export type HeatmapInspectorCell = {
  id: string;
  weekIndex: number;
  dayIndex: number;
  intensity: number;
  dateLabel: string | null;
  commitCount: number | null;
  machineSummary: string | null;
  repoSummary: string | null;
  detailsAvailable: boolean;
};

function dayLabelKeys(label: string): { short: string | null; mmdd: string | null } {
  const raw = label.trim();
  const mmdd = /^\d{2}-\d{2}$/.test(raw) ? raw : null;
  const short = /^[A-Za-z]{3}\s+\d{2}$/.test(raw) ? raw : null;
  return { short, mmdd };
}

function timestampToKeys(timestamp: string): { short: string | null; mmdd: string | null } {
  const parsed = new Date(timestamp);
  if (Number.isNaN(parsed.getTime())) return { short: null, mmdd: null };
  const month = parsed.toLocaleString("en-US", { month: "short", timeZone: "UTC" });
  const day = String(parsed.getUTCDate()).padStart(2, "0");
  const mm = String(parsed.getUTCMonth() + 1).padStart(2, "0");
  return { short: `${month} ${day}`, mmdd: `${mm}-${day}` };
}

export function buildHeatmapInspectorCells(
  heatmap: number[][],
  commitTrend: HeatmapTrendRow[],
  timeline: HeatmapTimelineRow[],
): HeatmapInspectorCell[] {
  const baseCells = heatmap.flatMap((week, weekIndex) =>
    week.map((intensity, dayIndex) => ({
      id: `cell-${weekIndex}-${dayIndex}`,
      weekIndex,
      dayIndex,
      intensity,
    })),
  );

  const trendTail = commitTrend.slice(-baseCells.length);
  const trendStart = baseCells.length - trendTail.length;

  return baseCells.map((cell, index) => {
    const trend = index >= trendStart ? trendTail[index - trendStart] : null;
    if (!trend) {
      return {
        ...cell,
        dateLabel: null,
        commitCount: null,
        machineSummary: null,
        repoSummary: null,
        detailsAvailable: false,
      };
    }

    const trendKeys = dayLabelKeys(trend.day);
    const matching = timeline.filter((event) => {
      const eventKeys = timestampToKeys(event.timestamp);
      return (
        (trendKeys.short && eventKeys.short === trendKeys.short) ||
        (trendKeys.mmdd && eventKeys.mmdd === trendKeys.mmdd)
      );
    });

    const uniqueRepos = new Set(matching.map((event) => event.repoId));
    const machineParts: string[] = [];
    if (trend.laptop > 0) machineParts.push(`Laptop ${trend.laptop}`);
    if (trend.nuc1 > 0) machineParts.push(`NUC1 ${trend.nuc1}`);
    if (trend.nuc2 > 0) machineParts.push(`NUC2 ${trend.nuc2}`);

    return {
      ...cell,
      dateLabel: trend.day,
      commitCount: trend.total,
      machineSummary: machineParts.length > 0 ? machineParts.join(", ") : null,
      repoSummary: matching.length > 0 ? `${matching.length} events across ${uniqueRepos.size} repos` : null,
      detailsAvailable: true,
    };
  });
}
