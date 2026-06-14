// ---------------------------------------------------------------------------
// Facebook ads aggregation. No row-level join to orders is possible (no shared
// key), so this works at the placement-aggregate level only + reconciliation.
// ---------------------------------------------------------------------------

import { ADS_COLS, RawRow } from "./mapping";

// Placements widely associated with low-intent / accidental clicks in Libya COD.
const JUNK_PLACEMENTS = [
  "Native, banner & interstitial", // Audience Network
  "In-stream reels",
  "Rewarded video",
];

// CPR thresholds calibrated for Libya COD market (USD).
// These are opinionated benchmarks — adjust as real data accumulates.
export const CPR_THRESHOLDS = {
  excellent: 1.0,  // < $1.00 → ممتاز
  good: 1.80,      // $1.00 – $1.79 → جيد
  average: 2.50,   // $1.80 – $2.49 → متوسط
  // ≥ $2.50 → مرتفع جداً → أوقفه
};

export type CprRating = "excellent" | "good" | "average" | "poor";

export function rateCpr(cpr: number | null): CprRating {
  if (cpr === null) return "poor";
  if (cpr < CPR_THRESHOLDS.excellent) return "excellent";
  if (cpr < CPR_THRESHOLDS.good) return "good";
  if (cpr < CPR_THRESHOLDS.average) return "average";
  return "poor";
}

export interface PlacementStat {
  placement: string;
  results: number;
  spend: number;
  costPerResult: number | null;
  impressions: number;
  flagged: boolean;       // known junk-prone placement
  cprRating: CprRating;  // quality label for this placement
}

export interface AdsFacts {
  totalResults: number;
  totalSpend: number;
  blendedCostPerResult: number | null;
  blendedCprRating: CprRating;
  estimatedWastedSpend: number;   // spend on flagged/junk placements
  reportStart: string | null;
  reportEnd: string | null;
  byPlacement: PlacementStat[];
  bestPlacement: PlacementStat | null;   // lowest CPR with results
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
    .map(([placement, v]) => {
      const cpr = v.results > 0 ? +(v.spend / v.results).toFixed(2) : null;
      return {
        placement,
        results: v.results,
        spend: +v.spend.toFixed(2),
        costPerResult: cpr,
        impressions: v.impr,
        flagged: JUNK_PLACEMENTS.some((j) => placement.includes(j)),
        cprRating: rateCpr(cpr),
      };
    })
    .sort((a, b) => b.spend - a.spend);

  const totalResults = byPlacement.reduce((s, p) => s + p.results, 0);
  const totalSpend = +byPlacement.reduce((s, p) => s + p.spend, 0).toFixed(2);
  const blendedCpr = totalResults > 0 ? +(totalSpend / totalResults).toFixed(2) : null;

  const withResults = byPlacement.filter((p) => p.costPerResult !== null && p.results > 0);

  const worst =
    withResults.length > 0
      ? withResults.reduce((w, p) =>
          (p.costPerResult ?? 0) > (w.costPerResult ?? 0) ? p : w
        )
      : null;

  const best =
    withResults.length > 0
      ? withResults.reduce((b, p) =>
          (p.costPerResult ?? Infinity) < (b.costPerResult ?? Infinity) ? p : b
        )
      : null;

  const flaggedPlacements = byPlacement.filter((p) => p.flagged && p.spend > 0);
  const estimatedWastedSpend = +flaggedPlacements
    .reduce((s, p) => s + p.spend, 0)
    .toFixed(2);

  return {
    totalResults,
    totalSpend,
    blendedCostPerResult: blendedCpr,
    blendedCprRating: rateCpr(blendedCpr),
    estimatedWastedSpend,
    reportStart: start,
    reportEnd: end,
    byPlacement,
    bestPlacement: best,
    worstCostPerResult: worst,
    flaggedPlacements,
  };
}
