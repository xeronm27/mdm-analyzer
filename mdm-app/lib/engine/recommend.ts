// ---------------------------------------------------------------------------
// Deterministic recommendation rules. These fire on the computed facts BEFORE
// any AI involvement. Each recommendation carries the evidence it was based on.
// The AI layer (Stage 2) only rephrases these; it cannot add new numbers.
// ---------------------------------------------------------------------------

import { RateBlock, SellerReport } from "./compute";
import { OWNER_LABEL } from "./classify";
import { AdsFacts } from "./ads";

export interface Recommendation {
  priority: "high" | "medium" | "low";
  owner: string;
  titleEn: string;
  titleAr: string;
  evidence: string;
}

// thresholds (tunable)
const T = {
  duplicateShare: 0.15, // removed dupes as share of all orders
  openShare: 0.25, // open bucket as share of decided+open
  ownerShare: 30, // a failure owner taking >=30% of cancellations
  invalidPhoneShare: 0.2,
};

export function recommendForSeller(s: SellerReport, ads?: AdsFacts): Recommendation[] {
  const recs: Recommendation[] = [];
  const r: RateBlock = s;

  // 1. Duplicates distorting the picture
  if (r.orders > 0 && r.removedDuplicates / r.orders >= T.duplicateShare) {
    recs.push({
      priority: "medium",
      owner: "Us / Merchant",
      titleEn: "Fix order intake to stop duplicate submissions",
      titleAr: "إصلاح إدخال الطلبات لمنع الطلبات المكررة",
      evidence: `${r.removedDuplicates} of ${r.orders} orders were duplicates (${pct(r.removedDuplicates, r.orders)}%).`,
    });
  }

  // 2. Large open / unreached bucket -> call-center cadence
  const totalReachable = r.decided + r.open;
  if (totalReachable > 0 && r.open / totalReachable >= T.openShare) {
    recs.push({
      priority: "high",
      owner: OWNER_LABEL.us.en,
      titleEn: "Improve call cadence: 3 attempts at different times + WhatsApp confirmation",
      titleAr: "تحسين جدول الاتصال: 3 محاولات بأوقات مختلفة + تأكيد عبر واتساب",
      evidence: `${r.open} orders are unreached/open (${pct(r.open, totalReachable)}% of leads), recoverable revenue.`,
    });
  }

  // 3. Dominant failure owner
  const top = r.failuresByOwner[0];
  if (top && top.share >= T.ownerShare && top.owner !== "uncategorized") {
    recs.push(ownerRule(top.owner, top.count, top.share));
  }

  // 4. Invalid phone numbers
  if (r.orders > 0 && s.invalidPhones / r.orders >= T.invalidPhoneShare) {
    recs.push({
      priority: "medium",
      owner: OWNER_LABEL.us.en,
      titleEn: "Add phone-number validation at the order form",
      titleAr: "إضافة تحقق من رقم الهاتف في نموذج الطلب",
      evidence: `${s.invalidPhones} orders have phone numbers that don't match Libyan format.`,
    });
  }

  // 5. Ads-level: flagged junk placements still spending
  if (ads && ads.flaggedPlacements.length > 0) {
    const f = ads.flaggedPlacements[0];
    recs.push({
      priority: "high",
      owner: OWNER_LABEL.ads.en,
      titleEn: `Disable low-quality placement "${f.placement}" or switch to manual placements`,
      titleAr: `إيقاف الموضع منخفض الجودة "${f.placement}" أو التحويل إلى المواضع اليدوية`,
      evidence: `${f.placement} spent $${f.spend} at $${f.costPerResult}/result (known source of low-intent leads).`,
    });
  }

  return dedupeAndRank(recs);
}

function ownerRule(
  owner: string,
  count: number,
  share: number
): Recommendation {
  const ev = `${owner} accounts for ${share}% of cancellations (${count} orders).`;
  switch (owner) {
    case "ads":
      return {
        priority: "high",
        owner: OWNER_LABEL.ads.en,
        titleEn: "Tighten ad targeting & exclude junk placements (high fake-lead rate)",
        titleAr: "تضييق استهداف الإعلانات واستبعاد المواضع الرديئة (نسبة طلبات وهمية عالية)",
        evidence: ev,
      };
    case "merchant":
      return {
        priority: "high",
        owner: OWNER_LABEL.merchant.en,
        titleEn: "Review pricing / clarify value on the landing page; check stock",
        titleAr: "مراجعة التسعير وتوضيح القيمة في صفحة الهبوط؛ والتحقق من المخزون",
        evidence: ev,
      };
    case "product":
      return {
        priority: "medium",
        owner: OWNER_LABEL.product.en,
        titleEn: "Re-check product price vs. market & landing-page accuracy",
        titleAr: "إعادة فحص سعر المنتج مقابل السوق ودقة صفحة الهبوط",
        evidence: ev,
      };
    case "us":
      return {
        priority: "high",
        owner: OWNER_LABEL.us.en,
        titleEn: "Strengthen call-center follow-up (no-answer / unreachable dominate)",
        titleAr: "تعزيز متابعة مركز الاتصال (الغالب: عدم الرد / تعذر الوصول)",
        evidence: ev,
      };
    default:
      return {
        priority: "medium",
        owner: OWNER_LABEL.customer.en,
        titleEn: "Improve lead qualification to reduce non-serious customers",
        titleAr: "تحسين تأهيل العملاء لتقليل غير الجادين",
        evidence: ev,
      };
  }
}

const pct = (a: number, b: number) => (b === 0 ? 0 : Math.round((a / b) * 100));

function dedupeAndRank(recs: Recommendation[]): Recommendation[] {
  const seen = new Set<string>();
  const order = { high: 0, medium: 1, low: 2 };
  return recs
    .filter((r) => (seen.has(r.titleEn) ? false : (seen.add(r.titleEn), true)))
    .sort((a, b) => order[a.priority] - order[b.priority]);
}
