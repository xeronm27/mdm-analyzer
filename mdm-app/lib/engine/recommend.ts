// ---------------------------------------------------------------------------
// Deterministic recommendation rules. These fire on the computed facts BEFORE
// any AI involvement. Each recommendation carries the evidence it was based on.
// The AI layer (Stage 2) only rephrases these; it cannot add new numbers.
// ---------------------------------------------------------------------------

import { RateBlock, SellerReport } from "./compute";
import { OWNER_LABEL } from "./classify";
import { AdsFacts, CPR_THRESHOLDS } from "./ads";

export interface Recommendation {
  priority: "high" | "medium" | "low";
  actionType: "stop" | "improve" | "test";
  owner: string;
  titleEn: string;
  titleAr: string;
  evidence: string;
}

// thresholds (tunable)
const T = {
  duplicateShare: 0.15,
  openShare: 0.25,
  ownerShare: 30,
  invalidPhoneShare: 0.2,
  highCpr: CPR_THRESHOLDS.average,
  wastedSpendMin: 5,
};

export function recommendForSeller(
  s: SellerReport,
  ads?: AdsFacts
): Recommendation[] {
  const recs: Recommendation[] = [];
  const r: RateBlock = s;

  // 1. Duplicates distorting the picture
  if (r.orders > 0 && r.removedDuplicates / r.orders >= T.duplicateShare) {
    recs.push({
      priority: "medium",
      actionType: "improve",
      owner: "Us / Merchant",
      titleEn: "Fix order intake to stop duplicate submissions",
      titleAr: "إصلاح إدخال الطلبات لمنع الطلبات المكررة",
      evidence: `${r.removedDuplicates} of ${r.orders} orders were duplicates (${pct(r.removedDuplicates, r.orders)}%).`,
    });
  }

  // 2. Large open / unreached bucket
  const totalReachable = r.decided + r.open;
  if (totalReachable > 0 && r.open / totalReachable >= T.openShare) {
    recs.push({
      priority: "high",
      actionType: "improve",
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
      actionType: "improve",
      owner: OWNER_LABEL.us.en,
      titleEn: "Add phone-number validation at the order form",
      titleAr: "إضافة تحقق من رقم الهاتف في نموذج الطلب",
      evidence: `${s.invalidPhones} orders have phone numbers that don't match Libyan format.`,
    });
  }

  // ── Facebook-specific rules ──────────────────────────────────────────────

  if (ads) {
    // 5. Junk/flagged placements wasting budget
    if (ads.flaggedPlacements.length > 0 && ads.estimatedWastedSpend >= T.wastedSpendMin) {
      const names = ads.flaggedPlacements.map((p) => p.placement).join(", ");
      recs.push({
        priority: "high",
        actionType: "stop",
        owner: OWNER_LABEL.ads.en,
        titleEn: `Disable junk placements to save $${ads.estimatedWastedSpend} in wasted spend`,
        titleAr: `أوقف المواضع الرديئة لتوفير $${ads.estimatedWastedSpend} من الإنفاق الضائع`,
        evidence: `${names} — known low-intent placements (accidental clicks, non-buyers). Go to Ads Manager → Ad Set → Edit Placements → Manual Placements → uncheck these.`,
      });
    } else if (ads.flaggedPlacements.length > 0) {
      const f = ads.flaggedPlacements[0];
      recs.push({
        priority: "medium",
        actionType: "stop",
        owner: OWNER_LABEL.ads.en,
        titleEn: `Switch to Manual Placements and exclude "${f.placement}"`,
        titleAr: `التحويل إلى المواضع اليدوية واستبعاد "${f.placement}"`,
        evidence: `${f.placement} spent $${f.spend} at $${f.costPerResult}/result — low-intent placement for COD.`,
      });
    }

    // 6. High blended CPR
    if (
      ads.blendedCostPerResult !== null &&
      ads.blendedCostPerResult >= T.highCpr
    ) {
      recs.push({
        priority: "high",
        actionType: "improve",
        owner: OWNER_LABEL.ads.en,
        titleEn: `Overall cost-per-result is high ($${ads.blendedCostPerResult}) — review audience targeting`,
        titleAr: `تكلفة النتيجة الإجمالية مرتفعة ($${ads.blendedCostPerResult}) — راجع استهداف الجمهور`,
        evidence: `Libya COD benchmark is under $${CPR_THRESHOLDS.good}/result. Your blended CPR of $${ads.blendedCostPerResult} means your audience likely contains low-intent buyers. Try narrowing age, adding interest filters, or excluding previous buyers.`,
      });
    }

    // 7. Best placement → scale it
    if (
      ads.bestPlacement &&
      ads.bestPlacement.results >= 5 &&
      ads.bestPlacement.cprRating !== "poor"
    ) {
      const b = ads.bestPlacement;
      recs.push({
        priority: "low",
        actionType: "test",
        owner: OWNER_LABEL.ads.en,
        titleEn: `Scale up "${b.placement}" — your best-performing placement at $${b.costPerResult}/result`,
        titleAr: `زِد ميزانية "${b.placement}" — أفضل موضع لديك بـ $${b.costPerResult}/نتيجة`,
        evidence: `${b.placement} generated ${b.results} results at $${b.costPerResult}/result ($${b.spend.toFixed(2)} spent). Increase its budget allocation within the same ad set.`,
      });
    }

    // 8. Worst non-junk placement
    if (
      ads.worstCostPerResult &&
      ads.bestPlacement &&
      ads.worstCostPerResult.placement !== ads.bestPlacement.placement &&
      ads.worstCostPerResult.cprRating === "poor" &&
      !ads.worstCostPerResult.flagged
    ) {
      const w = ads.worstCostPerResult;
      recs.push({
        priority: "medium",
        actionType: "stop",
        owner: OWNER_LABEL.ads.en,
        titleEn: `Pause or reduce "${w.placement}" — $${w.costPerResult}/result is too expensive`,
        titleAr: `أوقف أو قلّص "${w.placement}" — $${w.costPerResult}/نتيجة مرتفع جداً`,
        evidence: `${w.placement} is costing $${w.costPerResult}/result vs your best placement at $${ads.bestPlacement.costPerResult}/result. Reallocate that $${w.spend.toFixed(2)} budget to better placements.`,
      });
    }
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
        actionType: "stop",
        owner: OWNER_LABEL.ads.en,
        titleEn: "Tighten ad targeting & exclude junk placements (high fake-lead rate)",
        titleAr: "تضييق استهداف الإعلانات واستبعاد المواضع الرديئة (نسبة طلبات وهمية عالية)",
        evidence: ev,
      };
    case "merchant":
      return {
        priority: "high",
        actionType: "improve",
        owner: OWNER_LABEL.merchant.en,
        titleEn: "Review pricing / clarify value on the landing page; check stock",
        titleAr: "مراجعة التسعير وتوضيح القيمة في صفحة الهبوط؛ والتحقق من المخزون",
        evidence: ev,
      };
    case "product":
      return {
        priority: "medium",
        actionType: "improve",
        owner: OWNER_LABEL.product.en,
        titleEn: "Re-check product price vs. market & landing-page accuracy",
        titleAr: "إعادة فحص سعر المنتج مقابل السوق ودقة صفحة الهبوط",
        evidence: ev,
      };
    case "us":
      return {
        priority: "high",
        actionType: "improve",
        owner: OWNER_LABEL.us.en,
        titleEn: "Strengthen call-center follow-up (no-answer / unreachable dominate)",
        titleAr: "تعزيز متابعة مركز الاتصال (الغالب: عدم الرد / تعذر الوصول)",
        evidence: ev,
      };
    default:
      return {
        priority: "medium",
        actionType: "improve",
        owner: OWNER_LABEL.customer.en,
        titleEn: "Improve lead qualification to reduce non-serious customers",
        titleAr: "تحسين تأهيل العملاء لتقليل غير الجادين",
        evidence: ev,
      };
  }
}

const pct = (a: number, b: number) =>
  b === 0 ? 0 : Math.round((a / b) * 100);

function dedupeAndRank(recs: Recommendation[]): Recommendation[] {
  const seen = new Set<string>();
  const order = { high: 0, medium: 1, low: 2 };
  return recs
    .filter((r) =>
      seen.has(r.titleEn) ? false : (seen.add(r.titleEn), true)
    )
    .sort((a, b) => order[a.priority] - order[b.priority]);
}
