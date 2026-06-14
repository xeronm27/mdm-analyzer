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
      note:
        "Orders and ads exports must cover the same date range before funnel reconciliation is valid. No row-level key links an order to a placement.",
    },
    sellers: sellerFacts,
  };
}
