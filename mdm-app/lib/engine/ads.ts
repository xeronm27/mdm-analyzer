// ---------------------------------------------------------------------------
// Facebook ads aggregation. No row-level join to orders is possible (no shared
// key), so this works at the placement-aggregate level only + reconciliation.
// ---------------------------------------------------------------------------

import { ADS_COLS, RawRow } from "./mapping";

// Placements widely associated with low-intent / accidental clicks.
const JUNK_PLACEMENTS = [
  "Native, banner & interstitial", // Audience Network
  "In-stream reels",
  "Rewarded video",
];

export interface PlacementStat {
  placement: string;
  results: number;
  spend: number;
  costPerResult: number | null;
  impressions: number;
  flagged: boolean; // known junk-prone placement
}

export interface AdsFacts {
  totalResults: number;
  totalSpend: number;
  blendedCostPerResult: number | null;
  reportStart: string | null;
  reportEnd: string | null;
  byPlacement: PlacementStat[];
  worstCostPerResult: PlacementStat | null;
  flaggedPlacements: PlacementStat[];
}

function num(v: unknown): number {
  const n = Number(String(v ?? "").replace(/[^\d.\-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

export function buildAdsFacts(rows: RawRow[]): AdsFacts {
  const agg = new Map<string, { results: number; spend: number; impr: number }>();
  let start: string | null = null;
  let end: string | null = null;

  for (const r of rows) {
    const placement = String(r[ADS_COLS.placement] ?? "").trim() || "(none)";
    const a = agg.get(placement) ?? { results: 0, spend: 0, impr: 0 };
    a.results += num(r[ADS_COLS.results]);
    a.spend += num(r[ADS_COLS.spend]);
    a.impr += num(r[ADS_COLS.impressions]);
    agg.set(placement, a);
    start = start ?? (r[ADS_COLS.reportStart] ? String(r[ADS_COLS.reportStart]) : null);
    end = end ?? (r[ADS_COLS.reportEnd] ? String(r[ADS_COLS.reportEnd]) : null);
  }

  const byPlacement: PlacementStat[] = [...agg.entries()]
    .map(([placement, v]) => ({
      placement,
      results: v.results,
      spend: +v.spend.toFixed(2),
      costPerResult: v.results > 0 ? +(v.spend / v.results).toFixed(2) : null,
      impressions: v.impr,
      flagged: JUNK_PLACEMENTS.some((j) => placement.includes(j)),
    }))
    .sort((a, b) => b.spend - a.spend);

  const totalResults = byPlacement.reduce((s, p) => s + p.results, 0);
  const totalSpend = +byPlacement.reduce((s, p) => s + p.spend, 0).toFixed(2);

  const withResults = byPlacement.filter((p) => p.costPerResult !== null);
  const worst =
    withResults.length > 0
      ? withResults.reduce((w, p) =>
          (p.costPerResult ?? 0) > (w.costPerResult ?? 0) ? p : w
        )
      : null;

  return {
    totalResults,
    totalSpend,
    blendedCostPerResult: totalResults > 0 ? +(totalSpend / totalResults).toFixed(2) : null,
    reportStart: start,
    reportEnd: end,
    byPlacement,
    worstCostPerResult: worst,
    flaggedPlacements: byPlacement.filter((p) => p.flagged && p.spend > 0),
  };
}
