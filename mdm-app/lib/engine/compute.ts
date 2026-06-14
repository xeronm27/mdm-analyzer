// ---------------------------------------------------------------------------
// Cleaning + confirmation-rate computation.  Pure functions, fully testable.
// Confirmation rate (LOCKED) = confirmed / (confirmed + cancelled).
// not-answer + pending = "open / recoverable" bucket, excluded from denominator.
// ---------------------------------------------------------------------------

import { Order } from "./mapping";
import {
  classifyReason,
  DUPLICATE_REASONS,
  Owner,
  OWNER_LABEL,
} from "./classify";

// Human-readable labels for "ads"-classified cancellation reasons
// (fake / low-quality leads that came through the ad funnel)
const FAKE_LEAD_LABELS: Record<string, { en: string; ar: string }> = {
  "the-phone-number-is-wrong":       { en: "Wrong phone number",          ar: "رقم هاتف خاطئ" },
  "false-order":                     { en: "False order",                  ar: "طلب وهمي" },
  "fake-order":                      { en: "Fake order",                   ar: "طلب مزيف" },
  "order-pass-by-child":             { en: "Order placed by a child",      ar: "طلب نفّذه طفل" },
  "african-bad-lead":                { en: "Non-target / bad lead",        ar: "ليد خارج الاستهداف" },
  "delivery-mentioned-free":         { en: "Ad promised free delivery",    ar: "الإعلان ذكر توصيل مجاني" },
  "the-client-did-not-place-the-order": { en: "Client never placed order", ar: "العميل لم يطلب أصلاً" },
};

export interface FakeLeadReason {
  reason: string;
  labelEn: string;
  labelAr: string;
  count: number;
  share: number; // % of total cancelled
}

export interface RateBlock {
  orders: number;             // total rows in scope
  removedDuplicates: number;  // platform-flagged dupes removed before the rate
  suspectedDuplicates: number;
  decided: number;            // confirmed + cancelled
  confirmed: number;
  cancelled: number;
  open: number;               // not-answer + pending
  notAnswer: number;
  pending: number;
  rawConfirmationRate: number | null;
  confirmationRate: number | null;
  failuresByOwner: { owner: Owner | "uncategorized"; count: number; share: number }[];
  topFailureOwner: Owner | "uncategorized" | null;
  uncategorizedReasons: number;
  // Fake lead breakdown (ads-classified cancellation reasons)
  fakeLeadReasons: FakeLeadReason[];
  fakeLeadTotal: number;   // sum of all ads-classified cancellations
  fakeLeadShare: number;   // % of total cancelled
}

function rateOf(confirmed: number, cancelled: number): number | null {
  const d = confirmed + cancelled;
  return d === 0 ? null : +((confirmed / d) * 100).toFixed(1);
}

function countSuspectedDuplicates(orders: Order[]): number {
  const groups = new Map<string, number>();
  for (const o of orders) {
    const key = `${o.phone}|${o.productId}`;
    groups.set(key, (groups.get(key) ?? 0) + 1);
  }
  let extra = 0;
  for (const n of groups.values()) if (n > 1) extra += n - 1;
  return extra;
}

export function computeRate(allOrders: Order[]): RateBlock {
  // 1. Remove platform-flagged duplicates before anything else
  const removed = allOrders.filter(
    (o) => o.reason !== null && DUPLICATE_REASONS.has(o.reason)
  );
  const scope = allOrders.filter(
    (o) => !(o.reason !== null && DUPLICATE_REASONS.has(o.reason))
  );

  let confirmed = 0,
    cancelled = 0,
    notAnswer = 0,
    pending = 0,
    uncategorized = 0;
  const ownerCounts = new Map<Owner | "uncategorized", number>();
  const fakeReasonCounts = new Map<string, number>();

  for (const o of scope) {
    if (o.status === "confirmed") confirmed++;
    else if (o.status === "cancelled") {
      cancelled++;
      const c = classifyReason(o.reason);
      ownerCounts.set(c.owner, (ownerCounts.get(c.owner) ?? 0) + 1);
      if (c.owner === "uncategorized") uncategorized++;
      // track fake lead reasons separately
      if (c.owner === "ads" && o.reason) {
        fakeReasonCounts.set(o.reason, (fakeReasonCounts.get(o.reason) ?? 0) + 1);
      }
    } else if (o.status === "not-answer") notAnswer++;
    else if (o.status === "pending") pending++;
    else uncategorized++;
  }

  // raw rate: include the flagged duplicates (the distorted "before" number)
  let rawConfirmed = 0, rawCancelled = 0;
  for (const o of allOrders) {
    if (o.status === "confirmed") rawConfirmed++;
    else if (o.status === "cancelled") rawCancelled++;
  }

  const failuresByOwner = [...ownerCounts.entries()]
    .map(([owner, count]) => ({
      owner,
      count,
      share: cancelled === 0 ? 0 : +((count / cancelled) * 100).toFixed(1),
    }))
    .sort((a, b) => b.count - a.count);

  // Build fake lead reason list (sorted by count desc)
  const fakeLeadReasons: FakeLeadReason[] = [...fakeReasonCounts.entries()]
    .map(([reason, count]) => {
      const label = FAKE_LEAD_LABELS[reason] ?? { en: reason, ar: reason };
      return {
        reason,
        labelEn: label.en,
        labelAr: label.ar,
        count,
        share: cancelled === 0 ? 0 : +((count / cancelled) * 100).toFixed(1),
      };
    })
    .sort((a, b) => b.count - a.count);

  const fakeLeadTotal = fakeLeadReasons.reduce((s, r) => s + r.count, 0);
  const fakeLeadShare = cancelled === 0 ? 0 : +((fakeLeadTotal / cancelled) * 100).toFixed(1);

  return {
    orders: allOrders.length,
    removedDuplicates: removed.length,
    suspectedDuplicates: countSuspectedDuplicates(scope),
    decided: confirmed + cancelled,
    confirmed,
    cancelled,
    open: notAnswer + pending,
    notAnswer,
    pending,
    rawConfirmationRate: rateOf(rawConfirmed, rawCancelled),
    confirmationRate: rateOf(confirmed, cancelled),
    failuresByOwner,
    topFailureOwner: failuresByOwner[0]?.owner ?? null,
    uncategorizedReasons: uncategorized,
    fakeLeadReasons,
    fakeLeadTotal,
    fakeLeadShare,
  };
}

export interface ProductReport extends RateBlock {
  productId: string;
  productName: string;
}

export interface SellerReport extends RateBlock {
  store: string;
  vsBenchmark: number | null;
  invalidPhones: number;
  products: ProductReport[];
}

export interface PlatformFacts {
  generatedAt: string;
  benchmarkConfirmationRate: number | null;
  totalSellers: number;
  totalOrders: number;
  sellers: SellerReport[];
}

export function buildSellerReports(orders: Order[]): {
  sellers: SellerReport[];
  benchmark: number | null;
} {
  const platform = computeRate(orders);
  const benchmark = platform.confirmationRate;

  const byStore = groupBy(orders, (o) => o.store);
  const sellers: SellerReport[] = [];

  for (const [store, storeOrders] of byStore) {
    const block = computeRate(storeOrders);
    const invalidPhones = storeOrders.filter((o) => !o.phoneValid).length;

    const byProduct = groupBy(storeOrders, (o) => o.productId);
    const products: ProductReport[] = [];
    for (const [productId, prodOrders] of byProduct) {
      const pb = computeRate(prodOrders);
      products.push({
        ...pb,
        productId,
        productName: prodOrders[0]?.productName ?? productId,
      });
    }
    products.sort((a, b) => (a.confirmationRate ?? 999) - (b.confirmationRate ?? 999));

    sellers.push({
      ...block,
      store,
      vsBenchmark:
        block.confirmationRate !== null && benchmark !== null
          ? +(block.confirmationRate - benchmark).toFixed(1)
          : null,
      invalidPhones,
      products,
    });
  }

  sellers.sort((a, b) => (a.confirmationRate ?? 999) - (b.confirmationRate ?? 999));
  return { sellers, benchmark };
}

function groupBy<T, K>(arr: T[], key: (t: T) => K): Map<K, T[]> {
  const m = new Map<K, T[]>();
  for (const item of arr) {
    const k = key(item);
    const g = m.get(k);
    if (g) g.push(item);
    else m.set(k, [item]);
  }
  return m;
}

export { OWNER_LABEL };
