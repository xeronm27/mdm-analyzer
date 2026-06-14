// ---------------------------------------------------------------------------
// Reason classification -> responsible party (built from the REAL reason slugs)
// AI is never involved here. This is a deterministic lookup. Unknown reasons
// go to an "uncategorized" review queue and are never silently guessed.
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
  "the-client-did-not-place-the-order": {
    owner: "ads",
    labelEn: "Fake / unintended lead (client never ordered)",
    labelAr: "طلب وهمي (العميل لم يطلب فعلاً)",
  },
  "the-client-does-not-respond": {
    owner: "us",
    labelEn: "Client does not respond",
    labelAr: "العميل لا يرد",
  },
  "the-client-is-unreachable": {
    owner: "us",
    labelEn: "Client unreachable",
    labelAr: "تعذر الوصول إلى العميل",
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
  "the-client-found-the-product-cheaper-elsewhere": {
    owner: "product",
    labelEn: "Found the product cheaper elsewhere",
    labelAr: "وجد المنتج أرخص في مكان آخر",
  },
  "the-client-finds-that-the-product-very-expensive": {
    owner: "merchant",
    labelEn: "Price too high",
    labelAr: "السعر مرتفع جداً",
  },
  "the-product-is-no-longer-available": {
    owner: "merchant",
    labelEn: "Product out of stock",
    labelAr: "المنتج غير متوفر",
  },
};

export const OWNER_LABEL: Record<Owner, { en: string; ar: string }> = {
  ads: { en: "Ads", ar: "الإعلانات" },
  merchant: { en: "Merchant", ar: "التاجر" },
  product: { en: "Product", ar: "المنتج" },
  us: { en: "Us (Call Center)", ar: "نحن (مركز الاتصال)" },
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
