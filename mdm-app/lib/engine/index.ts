// ---------------------------------------------------------------------------
// Orchestrator: raw rows in -> full `facts` object out.
// This is the single object the Stage-2 AI layer is allowed to read from.
// ---------------------------------------------------------------------------

import { RawRow, toOrder } from "./mapping";
import { buildSellerReports, SellerReport } from "./compute";
import { buildAdsFacts, AdsFacts } from "./ads";
import { recommendForSeller, Recommendation } from "./recommend";

export interface SellerFacts extends SellerReport {
  recommendations: Recommendation[];
}

export interface Facts {
  generatedAt: string;
  period: { orders: string | null; ads: string | null };
  benchmark: { confirmationRate: number | null; sellers: number; orders: number };
  ads: AdsFacts | null;
  dataQuality: {
    dateRangeAligned: boolean;
    note: string;
  };
  sellers: SellerFacts[];
}

export function analyze(orderRows: RawRow[], adsRows?: RawRow[]): Facts {
  const orders = orderRows.map(toOrder).filter((o) => o.orderId);
  const { sellers, benchmark } = buildSellerReports(orders);
  const ads = adsRows && adsRows.length ? buildAdsFacts(adsRows) : null;

  const sellerFacts: SellerFacts[] = sellers.map((s) => ({
    ...s,
    recommendations: recommendForSeller(s, ads ?? undefined),
  }));

  // Enrich AdsFacts with cross-dataset metrics that need both FB + MDM data
  if (ads) {
    const totalConfirmed = sellerFacts.reduce((s, sf) => s + sf.confirmed, 0);
    ads.costPerConfirmedOrder =
      totalConfirmed > 0
        ? +(ads.totalSpend / totalConfirmed).toFixed(2)
        : null;

    // Data matching warning: if FB results count differs significantly from MDM orders
    const diff = ads.totalResults - orders.length;
    const threshold = Math.max(5, Math.round(orders.length * 0.1));
    ads.dataMatchingWarning = {
      hasWarning: Math.abs(diff) > threshold,
      fbResults: ads.totalResults,
      mdmOrders: orders.length,
      diff,
    };
  }

  return {
    generatedAt: new Date().toISOString(),
    period: {
      orders: orders[0]?.createdAt ?? null,
      ads: ads ? `${ads.reportStart} → ${ads.reportEnd}` : null,
    },
    benchmark: {
      confirmationRate: benchmark,
      sellers: sellers.length,
      orders: orders.length,
    },
    ads,
    dataQuality: {
      dateRangeAligned: false,
      note: "Orders and ads exports must cover the same date range before funnel reconciliation is valid. No row-level key links an order to a placement.",
    },
    sellers: sellerFacts,
  };
}
