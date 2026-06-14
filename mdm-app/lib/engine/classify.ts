// ---------------------------------------------------------------------------
// Reason classification -> responsible party (built from the REAL reason slugs)
// AI is never involved here. This is a deterministic lookup. Unknown reasons
// go to an "uncategorized" review queue and are never silently guessed.
//
// OWNER LOGIC:
//   ads      → bad-quality / fake traffic from campaigns
//   us        → MDM Express internal ops failures (force-cancel, auto-cancel,
//               delivery coverage gaps, agent knowledge gaps)
//   customer  → customer's own decision or unreachability AFTER full follow-up
//               (call center calls 3x/day for 3 days + WhatsApp — not our fault)
//   merchant  → pricing, stock, fulfilment issues on the seller side
//   product   → product reputation or price-competitiveness issues
// ---------------------------------------------------------------------------

export type Owner = "ads" | "merchant" | "product" | "us" | "customer";

// reasons that mean the order is noise and must be removed before the rate
export const DUPLICATE_REASONS = new Set([
  "automatic-duplicated",
  "double-order",
]);

interface ReasonDef {
  owner: Owner;
  labelEn: string;
  labelAr: string;
}

export const REASON_MAP: Record<string, ReasonDef> = {

  // ── ADS (bad-quality traffic / misleading creatives) ─────────────────────
  "the-client-did-not-place-the-order": {
    owner: "ads",
    labelEn: "Fake / unintended lead (client never ordered)",
    labelAr: "طلب وهمي (العميل لم يطلب فعلاً)",
  },
  "the-phone-number-is-wrong": {
    owner: "ads",
    labelEn: "Wrong phone number (bad lead data)",
    labelAr: "رقم هاتف خاطئ (بيانات إعلان رديئة)",
  },
  "false-order": {
    owner: "ads",
    labelEn: "False order",
    labelAr: "طلب مزيف",
  },
  "fake-order": {
    owner: "ads",
    labelEn: "Fake order",
    labelAr: "طلب وهمي",
  },
  "order-pass-by-child": {
    owner: "ads",
    labelEn: "Order placed by child",
    labelAr: "الطلب قدّمه طفل",
  },
  "african-bad-lead": {
    owner: "ads",
    labelEn: "Out-of-market traffic (bad lead)",
    labelAr: "طلب من خارج السوق المستهدف",
  },
  "delivery-mentioned-free": {
    owner: "ads",
    labelEn: "Ad mentioned free delivery (misleading)",
    labelAr: "الإعلان ذكر توصيل مجاني (مضلِّل)",
  },

  // ── MDM EXPRESS / INTERNAL OPS ────────────────────────────────────────────
  "the-responsible-set-it-by-force": {
    owner: "us",
    labelEn: "Force-cancelled by agent",
    labelAr: "ألغاه المسؤول قسراً",
  },
  "the-wilaya-is-not-deliverable": {
    owner: "us",
    labelEn: "Wilaya not covered by delivery",
    labelAr: "الولاية غير مشمولة بالتوصيل",
  },
  "the-state-is-not-deliverable": {
    owner: "us",
    labelEn: "State not covered by delivery",
    labelAr: "المنطقة غير مشمولة بالتوصيل",
  },
  "need-more-info-about-the-product": {
    owner: "us",
    labelEn: "Agent couldn't answer product questions",
    labelAr: "المسؤول لم يستطع الإجابة عن أسئلة المنتج",
  },
  "automatic": {
    owner: "us",
    labelEn: "Auto-cancelled by platform",
    labelAr: "ألغي تلقائياً من المنصة",
  },
  "automatic-configuration": {
    owner: "us",
    labelEn: "Auto-cancelled (configuration rule)",
    labelAr: "ألغي تلقائياً (قاعدة إعداد)",
  },
  "automatic-bad-words": {
    owner: "us",
    labelEn: "Auto-cancelled (bad words detected)",
    labelAr: "ألغي تلقائياً (كلمات محظورة)",
  },
  "test-order": {
    owner: "us",
    labelEn: "Test order (internal)",
    labelAr: "طلب اختباري (داخلي)",
  },

  // ── CUSTOMER (unreachable after full follow-up, or their own decision) ─────
  "the-client-does-not-respond": {
    owner: "customer",
    labelEn: "Client does not respond (after full follow-up)",
    labelAr: "العميل لا يرد (بعد المتابعة الكاملة)",
  },
  "the-client-is-unreachable": {
    owner: "customer",
    labelEn: "Client unreachable (after full follow-up)",
    labelAr: "تعذر الوصول إلى العميل (بعد المتابعة الكاملة)",
  },
  "the-client-is-not-available": {
    owner: "customer",
    labelEn: "Client not available (after full follow-up)",
    labelAr: "العميل غير متاح (بعد المتابعة الكاملة)",
  },
  "the-client-is-on-the-move": {
    owner: "customer",
    labelEn: "Client on the move / not reachable",
    labelAr: "العميل في تنقل / تعذر التواصل معه",
  },
  "after-3-days-of-calls": {
    owner: "customer",
    labelEn: "No response after 3 days of calls",
    labelAr: "لم يرد بعد 3 أيام من المحاولات",
  },
  "line-is-busy": {
    owner: "customer",
    labelEn: "Line always busy",
    labelAr: "الخط مشغول دائماً",
  },
  "the-client-has-changed-his-mind": {
    owner: "customer",
    labelEn: "Client changed his mind",
    labelAr: "العميل غيّر رأيه",
  },
  "the-client-is-not-serious": {
    owner: "customer",
    labelEn: "Client not serious",
    labelAr: "العميل غير جاد",
  },
  "the-call-rejection-list": {
    owner: "customer",
    labelEn: "Do-not-call / rejection list",
    labelAr: "قائمة رفض الاتصال",
  },
  "the-client-has-no-money": {
    owner: "customer",
    labelEn: "Client has no money",
    labelAr: "العميل ليس لديه مال",
  },
  "the-client-has-already-purchased-this-product": {
    owner: "customer",
    labelEn: "Client already bought the product elsewhere",
    labelAr: "العميل اشترى المنتج من مكان آخر",
  },
  "the-client-no-longer-wants-this-product": {
    owner: "customer",
    labelEn: "Client no longer wants the product",
    labelAr: "العميل لم يعد يريد المنتج",
  },
  "cancel-per-sms": {
    owner: "customer",
    labelEn: "Customer cancelled via SMS",
    labelAr: "العميل ألغى عبر رسالة نصية",
  },
  "shipping-fees-too-high": {
    owner: "customer",
    labelEn: "Customer refused standard shipping fees",
    labelAr: "العميل رفض رسوم الشحن المعتادة",
  },

  // ── MERCHANT (pricing, stock, fulfilment) ─────────────────────────────────
  "the-client-finds-that-the-product-very-expensive": {
    owner: "merchant",
    labelEn: "Price too high",
    labelAr: "السعر مرتفع جداً",
  },
  "the-product-is-no-longer-available": {
    owner: "merchant",
    labelEn: "Product no longer available",
    labelAr: "المنتج لم يعد متوفراً",
  },
  "product-out-of-stock": {
    owner: "merchant",
    labelEn: "Product out of stock",
    labelAr: "المنتج نفد من المخزون",
  },
  "seller-did-not-provider-required-quantity": {
    owner: "merchant",
    labelEn: "Seller didn't provide required quantity",
    labelAr: "التاجر لم يوفر الكمية المطلوبة",
  },
  "card-payment-percentage-too-high": {
    owner: "merchant",
    labelEn: "Card payment fee too high",
    labelAr: "رسوم الدفع بالبطاقة مرتفعة جداً",
  },

  // ── PRODUCT (quality / reputation / price competitiveness) ───────────────
  "the-client-found-the-product-cheaper-elsewhere": {
    owner: "product",
    labelEn: "Found the product cheaper elsewhere",
    labelAr: "وجد المنتج أرخص في مكان آخر",
  },
  "because-of-bad-comments": {
    owner: "product",
    labelEn: "Bad reviews / comments about the product",
    labelAr: "تعليقات سلبية على المنتج",
  },
};

export const OWNER_LABEL: Record<Owner, { en: string; ar: string }> = {
  ads: { en: "Ads", ar: "الإعلانات" },
  merchant: { en: "Merchant", ar: "التاجر" },
  product: { en: "Product", ar: "المنتج" },
  us: { en: "MDM Express", ar: "MDM Express" },
  customer: { en: "Customer", ar: "العميل" },
};

export interface Classification {
  owner: Owner | "uncategorized";
  labelEn: string;
  labelAr: string;
}

export function classifyReason(reason: string | null): Classification {
  if (!reason) {
    return {
      owner: "uncategorized",
      labelEn: "Cancelled without a recorded reason",
      labelAr: "ملغى بدون سبب مسجّل",
    };
  }
  const def = REASON_MAP[reason];
  if (!def) {
    return { owner: "uncategorized", labelEn: reason, labelAr: reason };
  }
  return { owner: def.owner, labelEn: def.labelEn, labelAr: def.labelAr };
}
