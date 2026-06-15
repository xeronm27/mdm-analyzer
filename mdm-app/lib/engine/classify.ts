// ---------------------------------------------------------------------------
// Reason classification -> responsible party (built from the REAL reason slugs)
// AI is never involved here. This is a deterministic lookup. Unknown reasons
// go to an "uncategorized" review queue and are never silently guessed.
//
// OWNER LOGIC (internal/technical):
//   ads      → bad-quality / fake traffic from campaigns
//   us        → MDM Express internal ops failures
//   customer  → customer's own decision or unreachability AFTER full follow-up
//   merchant  → pricing, stock, fulfilment issues on the seller side
//   product   → product reputation or price-competitiveness issues
//
// MERCHANT CATEGORY (merchant-facing, 5 buckets):
//   lead_quality    → جودة الليدات   (fake, wrong number, child order)
//   communication   → التواصل         (no answer, unreachable)
//   purchase_intent → نية الشراء      (changed mind, not serious, no money)
//   price_offer     → السعر والعرض    (price too high, found cheaper)
//   product_clarity → وضوح المنتج    (bad reviews, needs more info)
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

// ── Merchant-facing 5-category system ────────────────────────────────────────

export type MerchantCategory =
  | "lead_quality"
  | "communication"
  | "purchase_intent"
  | "price_offer"
  | "product_clarity";

export const MERCHANT_CATEGORY_LABEL: Record<
  MerchantCategory,
  { en: string; ar: string; color: string }
> = {
  lead_quality:    { en: "Lead Quality",    ar: "جودة الليدات",   color: "#dc2626" },
  communication:   { en: "Communication",   ar: "التواصل",          color: "#f59e0b" },
  purchase_intent: { en: "Purchase Intent", ar: "نية الشراء",       color: "#8b5cf6" },
  price_offer:     { en: "Price & Offer",   ar: "السعر والعرض",     color: "#0ea5e9" },
  product_clarity: { en: "Product Clarity", ar: "وضوح المنتج",      color: "#14b8a6" },
};

export const MERCHANT_CATEGORY_DETAIL: Record<
  MerchantCategory,
  { whatItMeansAr: string; whatToDoAr: string; whatItMeansEn: string; whatToDoEn: string }
> = {
  lead_quality: {
    whatItMeansAr:
      "عملاء طلبوا دون نية شراء حقيقية — طلبات وهمية، أرقام خاطئة، أطفال. المشكلة في مصدر الإعلان لا في المنتج.",
    whatToDoAr:
      "أوقف المواضع الرديئة (Audience Network، In-stream) وفعّل المواضع اليدوية في Ads Manager.",
    whatItMeansEn:
      "Leads with no real purchase intent — fake orders, wrong numbers, children. Problem is in the ad source, not the product.",
    whatToDoEn:
      "Disable junk placements (Audience Network, In-stream) and switch to Manual Placements in Ads Manager.",
  },
  communication: {
    whatItMeansAr:
      "عملاء لا يردون أو لا يمكن الوصول إليهم بعد المتابعة الكاملة. قد تكون مشكلة في أوقات الاتصال أو قنوات التواصل.",
    whatToDoAr:
      "جرّب ساعات اتصال مختلفة، أضف تأكيداً عبر واتساب قبل الاتصال، وتحقق من صحة بيانات الاتصال.",
    whatItMeansEn:
      "Customers don't answer or can't be reached after full follow-up. Could be timing or contact channel issues.",
    whatToDoEn:
      "Try different calling hours, add WhatsApp pre-confirmation, and verify contact data quality.",
  },
  purchase_intent: {
    whatItMeansAr:
      "عملاء جادون غيّروا رأيهم أو لديهم قيود مالية. نسبة مرتفعة تشير لضعف في الإقناع أو سرعة المتابعة.",
    whatToDoAr:
      "سرّع عملية التأكيد (اتصل خلال ساعة من الطلب)، أضف ضماناً أو عرضاً تحفيزياً، وطوّر نص المحادثة.",
    whatItMeansEn:
      "Serious leads who changed mind or had financial constraints. High % signals weak persuasion or slow follow-up.",
    whatToDoEn:
      "Speed up confirmation (call within 1 hour of order), add a guarantee or incentive, and improve sales script.",
  },
  price_offer: {
    whatItMeansAr:
      "العملاء يجدون السعر مرتفعاً أو وجدوا بديلاً أرخص. مشكلة في القيمة المُقدَّمة أو التسعير مقارنةً بالسوق.",
    whatToDoAr:
      "قارن سعرك بالمنافسين، أضف قيمة (هدية، ضمان، شحن مجاني)، أو جرّب باقة منتجات لرفع القيمة الإجمالية.",
    whatItMeansEn:
      "Customers find the price too high or found a cheaper alternative. Pricing or perceived value problem.",
    whatToDoEn:
      "Compare your price with competitors, add value (gift, guarantee, free shipping), or test a product bundle.",
  },
  product_clarity: {
    whatItMeansAr:
      "العملاء غير متأكدين من المنتج أو لديهم توقعات مختلفة عما في الإعلان. مشكلة في وضوح المحتوى الإعلاني.",
    whatToDoAr:
      "أعد كتابة وصف المنتج، أضف فيديو توضيحياً، ووضّح الاستخدام والنتيجة المتوقعة بشكل صريح في الإعلان.",
    whatItMeansEn:
      "Customers unsure about the product or have different expectations than what the ad showed.",
    whatToDoEn:
      "Rewrite the product description, add an explanatory video, and clearly state usage and expected results in the ad.",
  },
};

// Direct mapping from reason slug → merchant category (bypasses Owner)
export const REASON_TO_MERCHANT_CATEGORY: Record<string, MerchantCategory> = {
  // Lead Quality
  "the-client-did-not-place-the-order": "lead_quality",
  "the-phone-number-is-wrong":          "lead_quality",
  "false-order":                         "lead_quality",
  "fake-order":                          "lead_quality",
  "order-pass-by-child":                 "lead_quality",
  "african-bad-lead":                    "lead_quality",
  "delivery-mentioned-free":             "lead_quality",

  // Communication
  "the-client-does-not-respond":         "communication",
  "the-client-is-unreachable":           "communication",
  "the-client-is-not-available":         "communication",
  "the-client-is-on-the-move":           "communication",
  "after-3-days-of-calls":              "communication",
  "line-is-busy":                        "communication",
  "the-call-rejection-list":             "communication",

  // Purchase Intent
  "the-client-has-changed-his-mind":     "purchase_intent",
  "the-client-is-not-serious":           "purchase_intent",
  "the-client-has-no-money":             "purchase_intent",
  "the-client-no-longer-wants-this-product": "purchase_intent",
  "cancel-per-sms":                      "purchase_intent",
  "the-client-has-already-purchased-this-product": "purchase_intent",

  // Price & Offer
  "the-client-finds-that-the-product-very-expensive": "price_offer",
  "shipping-fees-too-high":              "price_offer",
  "the-client-found-the-product-cheaper-elsewhere":   "price_offer",
  "card-payment-percentage-too-high":    "price_offer",

  // Product Clarity
  "because-of-bad-comments":            "product_clarity",
  "need-more-info-about-the-product":   "product_clarity",
};

export function classifyMerchantCategory(
  reason: string | null
): MerchantCategory | null {
  if (!reason) return null;
  return REASON_TO_MERCHANT_CATEGORY[reason] ?? null;
}
