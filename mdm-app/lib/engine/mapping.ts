// ---------------------------------------------------------------------------
// Column mapping + canonical model
// The engine never reads raw column names directly; it maps them here once,
// so a new merchant export = edit this file, not the logic.
// ---------------------------------------------------------------------------

export interface RawRow {
  [col: string]: unknown;
}

export interface Order {
  orderId: string;
  trackingId: string;
  store: string; // seller
  channel: string; // Source: lightfunnels / dashboard-bulk (NOT a FB placement)
  status: OrderStatus;
  reason: string | null; // coded slug
  responsible: string | null;
  createdAt: string | null;
  customer: string | null;
  phoneRaw: string | null;
  phone: string; // normalized
  phoneValid: boolean;
  productId: string; // primary product
  productName: string;
  quantity: number;
  price: number;
}

export type OrderStatus =
  | "confirmed"
  | "cancelled"
  | "not-answer"
  | "pending"
  | "unknown";

// --- Orders file: real columns from leads.xlsx -----------------------------
export const ORDER_COLS = {
  orderId: "Order Id",
  trackingId: "Tracking Id",
  store: "Store",
  channel: "Source",
  status: "Last Status",
  reason: "reason",
  responsible: "Responsible",
  createdAt: "Created At",
  customer: "Costumer",
  phone: "Costumer Phone",
  productIds: "Products Tracking Ids",
  productNames: "Products Names",
  quantities: "Products Quantities",
  price: "Total Products Price",
} as const;

// --- Facebook ads file: real columns from the FB export --------------------
export const ADS_COLS = {
  adSet: "Ad set name",
  platform: "Platform",
  placement: "Placement",
  resultType: "Result type",
  results: "Results",
  costPerResult: "Cost per result",
  spend: "Amount spent (USD)",
  impressions: "Impressions",
  reach: "Reach",
  reportStart: "Reporting starts",
  reportEnd: "Reporting ends",
} as const;

const STATUS_SET = new Set([
  "confirmed",
  "cancelled",
  "not-answer",
  "pending",
]);

function s(v: unknown): string {
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

function num(v: unknown): number {
  const n = Number(s(v).replace(/[^\d.\-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

// Libyan mobile normalization: target national form 09XXXXXXXX.
// Handles +218 / 00218 / spaces / parentheses. Flags clearly invalid numbers.
export function normalizePhone(raw: unknown): { phone: string; valid: boolean } {
  let d = s(raw).replace(/\D/g, "");
  if (!d) return { phone: "", valid: false };
  if (d.startsWith("00218")) d = d.slice(5);
  else if (d.startsWith("218")) d = d.slice(3);
  if (d.length === 9 && d.startsWith("9")) d = "0" + d;
  const valid = /^09\d{8}$/.test(d);
  return { phone: d, valid };
}

export function toOrder(row: RawRow): Order {
  const rawStatus = s(row[ORDER_COLS.status]).toLowerCase();
  const status = (STATUS_SET.has(rawStatus) ? rawStatus : "unknown") as OrderStatus;
  const { phone, valid } = normalizePhone(row[ORDER_COLS.phone]);
  const reason = s(row[ORDER_COLS.reason]);
  const productId = s(row[ORDER_COLS.productIds]).split(",")[0].trim();
  const productName = s(row[ORDER_COLS.productNames]).split(",")[0].trim();
  return {
    orderId: s(row[ORDER_COLS.orderId]),
    trackingId: s(row[ORDER_COLS.trackingId]),
    store: s(row[ORDER_COLS.store]) || "(unknown store)",
    channel: s(row[ORDER_COLS.channel]),
    status,
    reason: reason ? reason.toLowerCase() : null,
    responsible: s(row[ORDER_COLS.responsible]) || null,
    createdAt: s(row[ORDER_COLS.createdAt]) || null,
    customer: s(row[ORDER_COLS.customer]) || null,
    phoneRaw: s(row[ORDER_COLS.phone]) || null,
    phone,
    phoneValid: valid,
    productId: productId || "(no product id)",
    productName: productName || "(no product name)",
    quantity: num(row[ORDER_COLS.quantities]) || 1,
    price: num(row[ORDER_COLS.price]),
  };
}
