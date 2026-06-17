"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
} from "recharts";
import type { Facts, SellerFacts } from "@/lib/engine/index";
import type { Narrative } from "@/lib/ai";
import type { AdsFacts } from "@/lib/engine/ads";
import {
  MERCHANT_CATEGORY_LABEL,
  MERCHANT_CATEGORY_DETAIL,
  type MerchantCategory,
} from "@/lib/engine/classify";

// ── Confirmation-rate rating ──────────────────────────────────────────────
function getRating(rate: number | null) {
  if (rate === null)
    return { labelEn: "—", labelAr: "—", contextAr: "—", bg: "bg-slate-100", text: "text-slate-500", border: "border-slate-200" };
  if (rate >= 70)
    return { labelEn: "Excellent", labelAr: "ممتاز", contextAr: "نسبة استثنائية — أفضل من 90% من التجار في سوق الدفع عند الاستلام بليبيا. المنتج يبيع بشكل جيد جداً.", bg: "bg-emerald-500", text: "text-white", border: "border-emerald-400" };
  if (rate >= 60)
    return { labelEn: "Good", labelAr: "جيد", contextAr: "نسبة جيدة — تتجاوز متوسط السوق الليبي (COD). معظم التجار يتمنون الوصول لهذا المستوى.", bg: "bg-blue-500", text: "text-white", border: "border-blue-400" };
  if (rate >= 50)
    return { labelEn: "Average", labelAr: "متوسط", contextAr: "نسبة مقبولة لكن هناك مجال واضح للتحسين. المتوسط في السوق الليبي حول 55%.", bg: "bg-amber-400", text: "text-white", border: "border-amber-300" };
  return { labelEn: "Poor", labelAr: "ضعيف", contextAr: "نسبة دون المتوسط — يجب مراجعة جودة الإعلانات والمنتج فوراً لتجنب الخسائر.", bg: "bg-red-500", text: "text-white", border: "border-red-400" };
}

function rateColor(r: number | null) {
  if (r === null) return "#94a3b8";
  if (r >= 60) return "#16a34a";
  if (r >= 45) return "#d97706";
  return "#dc2626";
}

// ── Final diagnosis sentence ──────────────────────────────────────────────
function buildDiagnosisAr(seller: SellerFacts): string {
  const top = seller.categoryBreakdown.slice(0, 2);
  if (top.length === 0) return `نسبة التأكيد ${seller.confirmationRate}% — لا توجد بيانات كافية للتشخيص.`;
  const reasons = top.map((c) => `${MERCHANT_CATEGORY_LABEL[c.category].ar} (${c.share}%)`).join(" و");
  const rate = seller.confirmationRate ?? 0;
  const level = rate >= 60 ? "جيدة" : rate >= 50 ? "متوسطة" : "منخفضة";
  return `نسبة التأكيد ${level} (${seller.confirmationRate}%) بسبب ${reasons}.`;
}

// ── Root ──────────────────────────────────────────────────────────────────
export function Report({ facts }: { facts: Facts }) {
  const [idx, setIdx] = useState(0);
  const seller = facts.sellers[idx];
  return (
    <div className="mt-8 space-y-6">
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {facts.sellers.map((s, i) => (
            <button key={s.store} onClick={() => setIdx(i)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${i === idx ? "bg-brand text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:ring-brand"}`}>
              {s.store} · {s.confirmationRate}%
            </button>
          ))}
        </div>
        <button onClick={() => window.print()}
          className="rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white hover:brightness-125">
          Download PDF
        </button>
      </div>
      <SellerReport seller={seller} facts={facts} />
    </div>
  );
}

function SellerReport({ seller, facts }: { seller: SellerFacts; facts: Facts }) {
  return (
    <div className="space-y-6">

      {/* 1. Store Status */}
      <Header seller={seller} benchmark={facts.benchmark.confirmationRate} />

      {/* 2. Where orders are lost — 5 merchant categories */}
      <LossCategories seller={seller} />

      {/* 3. Top 3 problems */}
      <Top3Problems seller={seller} />

      {/* 4. Confirmation rate details */}
      <Card title="Real confirmation rate" subtitle="raw → cleaned (after removing duplicates)">
        <RateView seller={seller} />
      </Card>

      {/* 5. Facebook analysis */}
      {facts.ads && <FacebookEnhanced seller={seller} ads={facts.ads} />}

      {/* 6. Per-product */}
      <Card title="Per-product breakdown" subtitle="worst confirmation rate first">
        <ProductTable seller={seller} />
      </Card>

      {/* 7. Next week plan */}
      <NextWeekPlan seller={seller} />

      {/* 8. AI diagnosis */}
      <Card title="AI diagnosis" subtitle="interpretation only — every number is verified against the facts">
        <Diagnosis seller={seller} />
      </Card>
    </div>
  );
}

// ── 1. Header ─────────────────────────────────────────────────────────────
function Header({ seller, benchmark }: { seller: SellerFacts; benchmark: number | null }) {
  const vs = seller.vsBenchmark;
  const rating = getRating(seller.confirmationRate);
  const lqScore = seller.leadQualityScore;
  const lqColor = lqScore >= 70 ? "text-emerald-300" : lqScore >= 50 ? "text-amber-300" : "text-red-300";

  return (
    <div className="print-block rounded-2xl bg-gradient-to-br from-brand to-indigo-700 p-6 text-white shadow">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-sm uppercase tracking-wide text-indigo-200">Seller</div>
          <div className="text-3xl font-bold">{seller.store}</div>
          <div className={`mt-1 text-sm font-medium ${lqColor}`}>
            Lead Quality Score: {lqScore}/100
          </div>
        </div>
        <div className="text-right">
          <div className="flex items-end justify-end gap-3">
            <div className="text-5xl font-extrabold">
              {seller.confirmationRate}<span className="text-2xl">%</span>
            </div>
            <div className={`mb-1 rounded-xl px-3 py-1.5 text-sm font-bold ${rating.bg} ${rating.text} border ${rating.border}`}>
              {rating.labelAr} · {rating.labelEn}
            </div>
          </div>
          <div className="text-sm text-indigo-100">
            confirmation rate ·{" "}
            {vs === null ? "—" : `${vs >= 0 ? "+" : ""}${vs} pts vs benchmark ${benchmark}%`}
          </div>
        </div>
      </div>
      {/* Final diagnosis sentence */}
      <div className="mt-4 rounded-xl bg-white/10 px-4 py-3 text-sm text-indigo-50" dir="rtl">
        {buildDiagnosisAr(seller)}
      </div>
    </div>
  );
}

// ── Card wrapper ──────────────────────────────────────────────────────────
function Card({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }} transition={{ duration: 0.35 }}
      className="print-block rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4">
        <h3 className="font-semibold text-ink">{title}</h3>
        {subtitle && <p className="text-xs text-slate-400">{subtitle}</p>}
      </div>
      {children}
    </motion.div>
  );
}

// ── 2. Loss Categories (5 merchant-friendly categories) ───────────────────
function LossCategories({ seller }: { seller: SellerFacts }) {
  const ALL_CATEGORIES: MerchantCategory[] = [
    "lead_quality", "communication", "purchase_intent", "price_offer", "product_clarity",
  ];

  // Build a map for quick lookup
  const dataMap = new Map(seller.categoryBreakdown.map((c) => [c.category, c]));
  const maxShare = Math.max(...seller.categoryBreakdown.map((c) => c.share), 1);

  return (
    <Card title="أين تضيع الطلبات؟" subtitle="Where orders are lost — by merchant category">
      <div className="space-y-3">
        {ALL_CATEGORIES.map((cat) => {
          const d = dataMap.get(cat);
          const label = MERCHANT_CATEGORY_LABEL[cat];
          const count = d?.count ?? 0;
          const share = d?.share ?? 0;
          const barW = maxShare > 0 ? (share / maxShare) * 100 : 0;

          return (
            <div key={cat}>
              <div className="mb-1 flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                  <span className="inline-block h-3 w-3 rounded-sm shrink-0" style={{ background: label.color }} />
                  <span className="font-medium text-slate-700" dir="rtl">{label.ar}</span>
                  <span className="text-slate-400 text-xs">· {label.en}</span>
                </span>
                <span className="font-semibold text-slate-700">
                  {count > 0 ? `${count} (${share}%)` : "—"}
                </span>
              </div>
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${barW}%` }}
                  transition={{ duration: 0.7, ease: "easeOut" }}
                  className="h-full rounded-full"
                  style={{ background: label.color, opacity: count > 0 ? 1 : 0.2 }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Confirmation Loss Map */}
      <div className="mt-5 rounded-xl border border-slate-100 bg-slate-50 p-4">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-3">
          Confirmation Loss Map
        </div>
        <div className="flex items-center gap-2 flex-wrap text-sm">
          <Funnel label="Total orders" value={seller.orders} color="bg-slate-200 text-slate-700" />
          <Arrow />
          {seller.removedDuplicates > 0 && (
            <>
              <FunnelDrop label={`−${seller.removedDuplicates} duplicates`} color="text-slate-400" />
              <Arrow />
            </>
          )}
          {seller.fakeLeadTotal > 0 && (
            <>
              <FunnelDrop label={`−${seller.fakeLeadTotal} fake leads`} color="text-red-400" />
              <Arrow />
            </>
          )}
          {seller.open > 0 && (
            <>
              <FunnelDrop label={`${seller.open} unreached`} color="text-amber-400" />
              <Arrow />
            </>
          )}
          <Funnel
            label={`${seller.confirmed} confirmed`}
            value={`${seller.confirmationRate}%`}
            color="bg-emerald-100 text-emerald-700"
          />
        </div>
      </div>
    </Card>
  );
}

function Funnel({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div className={`rounded-lg px-3 py-2 text-center ${color}`}>
      <div className="text-base font-bold">{value}</div>
      <div className="text-[11px]">{label}</div>
    </div>
  );
}
function FunnelDrop({ label, color }: { label: string; color: string }) {
  return <span className={`text-xs font-medium ${color}`}>{label}</span>;
}
function Arrow() {
  return <span className="text-slate-300 text-lg">→</span>;
}

// ── 3. Top 3 Problems ─────────────────────────────────────────────────────
function Top3Problems({ seller }: { seller: SellerFacts }) {
  const top3 = seller.categoryBreakdown.slice(0, 3);

  if (top3.length === 0) {
    return null;
  }

  const rankColors = ["border-red-300 bg-red-50", "border-amber-300 bg-amber-50", "border-blue-200 bg-blue-50"];
  const rankNumColors = ["text-red-600", "text-amber-600", "text-blue-600"];

  return (
    <Card title="أهم 3 مشاكل" subtitle="Top 3 cancellation drivers — count · meaning · action">
      <div className="grid gap-4 sm:grid-cols-3">
        {top3.map((entry, i) => {
          const label = MERCHANT_CATEGORY_LABEL[entry.category];
          const detail = MERCHANT_CATEGORY_DETAIL[entry.category];
          return (
            <div key={entry.category} className={`rounded-xl border-2 p-4 ${rankColors[i]}`}>
              <div className="flex items-start justify-between gap-2 mb-2">
                <span className={`text-2xl font-black ${rankNumColors[i]}`}>{i + 1}</span>
                <span
                  className="inline-block rounded-md px-2 py-0.5 text-xs font-semibold text-white"
                  style={{ background: label.color }}
                >
                  {label.ar}
                </span>
              </div>
              <div className="text-2xl font-bold text-slate-800 mb-0.5">{entry.count}</div>
              <div className="text-sm text-slate-500 mb-3">{entry.share}% من الإلغاءات</div>
              <div className="text-xs text-slate-600 leading-relaxed mb-2" dir="rtl">
                <span className="font-semibold text-slate-700">ماذا يعني: </span>
                {detail.whatItMeansAr}
              </div>
              <div className="text-xs leading-relaxed rounded-lg bg-white/70 px-2 py-1.5" dir="rtl">
                <span className="font-semibold text-slate-700">الإجراء: </span>
                <span className="text-slate-600">{detail.whatToDoAr}</span>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// ── 4. Rate View ──────────────────────────────────────────────────────────
function RateView({ seller }: { seller: SellerFacts }) {
  const bars = [
    { label: "Raw", value: seller.rawConfirmationRate ?? 0, color: "#cbd5e1" },
    { label: "Cleaned", value: seller.confirmationRate ?? 0, color: rateColor(seller.confirmationRate) },
  ];
  return (
    <div>
      <div className="space-y-3">
        {bars.map((b) => (
          <div key={b.label}>
            <div className="mb-1 flex justify-between text-sm">
              <span className="text-slate-500">{b.label}</span>
              <span className="font-semibold">{b.value}%</span>
            </div>
            <div className="h-3 w-full overflow-hidden rounded-full bg-slate-100">
              <motion.div initial={{ width: 0 }} animate={{ width: `${b.value}%` }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                className="h-full rounded-full" style={{ background: b.color }} />
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 grid grid-cols-4 gap-2 text-center text-sm">
        <Stat label="Confirmed" value={seller.confirmed} tone="good" />
        <Stat label="Cancelled" value={seller.cancelled} tone="bad" />
        <Stat label="Open" value={seller.open} tone="warn" />
        <Stat label="Dupes removed" value={seller.removedDuplicates} />
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "good" | "bad" | "warn" }) {
  const c = tone === "good" ? "text-good" : tone === "bad" ? "text-bad" : tone === "warn" ? "text-warn" : "text-slate-700";
  return (
    <div className="rounded-lg bg-slate-50 py-2">
      <div className={`text-xl font-bold ${c}`}>{value}</div>
      <div className="text-[11px] text-slate-400">{label}</div>
    </div>
  );
}

// ── 5. Facebook Enhanced Section ──────────────────────────────────────────
function FacebookEnhanced({ seller, ads }: { seller: SellerFacts; ads: AdsFacts }) {
  const fakeTotal = seller.fakeLeadTotal;
  const fakeShare = seller.fakeLeadShare;
  const hasFakeLeads = fakeTotal > 0;
  const hasFlagged = ads.flaggedPlacements.length > 0;

  const FAKE_COLORS = ["#dc2626", "#ef4444", "#f87171", "#fca5a5", "#fecaca"];
  const donutData = seller.fakeLeadReasons.map((r, i) => ({
    name: r.labelAr,
    nameEn: r.labelEn,
    value: r.count,
    share: r.share,
    color: FAKE_COLORS[i % FAKE_COLORS.length],
  }));

  return (
    <Card title="تحليل Facebook" subtitle="Lead quality · cost per confirmed order · placement risk">

      {/* Data matching warning */}
      {ads.dataMatchingWarning?.hasWarning && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm" dir="rtl">
          <span className="font-semibold text-amber-800">⚠ تحذير: عدم تطابق البيانات</span>
          <span className="text-amber-700 mr-2">
            — Facebook تُظهر {ads.dataMatchingWarning.fbResults} نتيجة بينما MDM يحتوي {ads.dataMatchingWarning.mdmOrders} طلب.
            الفارق {Math.abs(ads.dataMatchingWarning.diff)} طلب قد يكون بسبب اختلاف النافذة الزمنية أو مشاكل التتبع.
          </span>
        </div>
      )}

      {/* Cost overview strip */}
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <CostCard label="Total leads" labelAr="إجمالي الليدز" value={ads.totalResults} />
        <CostCard
          label="Fake leads"
          labelAr={`ليدز وهمية (${fakeShare}%)`}
          value={fakeTotal}
          bad={hasFakeLeads}
        />
        <CostCard
          label="Cost / Lead"
          labelAr="تكلفة الليد"
          value={ads.blendedCostPerResult !== null ? `$${ads.blendedCostPerResult}` : "—"}
        />
        <CostCard
          label="Cost / Confirmed Order"
          labelAr="تكلفة الطلب المؤكد"
          value={ads.costPerConfirmedOrder !== null ? `$${ads.costPerConfirmedOrder}` : "—"}
          highlight
        />
      </div>

      {/* Best / worst placement summary */}
      <div className="mb-5 grid grid-cols-2 gap-3">
        {ads.bestPlacement && (
          <div className="rounded-xl bg-emerald-50 border border-emerald-100 px-4 py-3">
            <div className="text-[11px] font-semibold uppercase text-emerald-600 mb-1">✓ أفضل موضع</div>
            <div className="font-semibold text-slate-800 text-sm">{ads.bestPlacement.placement}</div>
            <div className="text-xs text-slate-500">${ads.bestPlacement.costPerResult}/result · {ads.bestPlacement.results} leads</div>
          </div>
        )}
        {ads.worstCostPerResult && (
          <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3">
            <div className="text-[11px] font-semibold uppercase text-red-600 mb-1">✕ أسوأ موضع (CPR)</div>
            <div className="font-semibold text-slate-800 text-sm">{ads.worstCostPerResult.placement}</div>
            <div className="text-xs text-slate-500">${ads.worstCostPerResult.costPerResult}/result · {ads.worstCostPerResult.results} leads</div>
          </div>
        )}
      </div>

      {/* Fake lead breakdown */}
      {hasFakeLeads ? (
        <div className="mb-5">
          <h4 className="text-sm font-semibold text-slate-700 mb-3" dir="rtl">
            أسباب الليدز الوهمية ({fakeTotal} طلب — {fakeShare}% من الإلغاءات)
          </h4>
          <div className="flex items-start gap-4">
            {donutData.length > 0 && (
              <div className="h-36 w-36 shrink-0">
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={donutData} dataKey="value" innerRadius={32} outerRadius={60} paddingAngle={2}>
                      {donutData.map((d, i) => <Cell key={i} fill={d.color} />)}
                    </Pie>
                    <Tooltip formatter={(v: number, _: string, props: any) => [`${v} orders`, props.payload.nameEn]} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
            <ul className="flex-1 space-y-2">
              {seller.fakeLeadReasons.map((r, i) => (
                <li key={r.reason} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <span className="inline-block h-2.5 w-2.5 rounded-full shrink-0"
                      style={{ background: FAKE_COLORS[i % FAKE_COLORS.length] }} />
                    <span className="text-slate-700">{r.labelAr}</span>
                  </span>
                  <span className="font-semibold text-red-600 ml-2">{r.count} ({r.share}%)</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : (
        <div className="mb-5 rounded-xl bg-emerald-50 border border-emerald-100 px-4 py-3 text-sm text-emerald-700" dir="rtl">
          ✓ لا توجد ليدز وهمية مكتشفة — جودة الليدز جيدة من ناحية المصدر.
        </div>
      )}

      {/* Placement table */}
      <div>
        <h4 className="text-sm font-semibold text-slate-700 mb-3">
          مواضع الإعلانات — خطر الليدز الوهمية
        </h4>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-slate-400 text-xs">
                <th className="pb-2">Placement / الموضع</th>
                <th className="pb-2">Results</th>
                <th className="pb-2">Spend</th>
                <th className="pb-2">CPL</th>
                <th className="pb-2">Risk</th>
              </tr>
            </thead>
            <tbody>
              {ads.byPlacement.filter((p) => p.results > 0).map((p) => (
                <tr key={p.placement} className="border-b last:border-0">
                  <td className="py-2 pr-3 font-medium text-slate-700">
                    {p.flagged && <span className="mr-1 text-amber-500">⚠</span>}
                    {p.placement}
                  </td>
                  <td className="py-2 text-slate-600">{p.results}</td>
                  <td className="py-2 text-slate-600">${p.spend}</td>
                  <td className="py-2 text-slate-600">{p.costPerResult !== null ? `$${p.costPerResult}` : "—"}</td>
                  <td className="py-2">
                    {p.flagged ? (
                      <span className="inline-flex items-center rounded-md bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 ring-1 ring-red-200">
                        مرتفع
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200">
                        منخفض ✓
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {hasFlagged && (
          <div className="mt-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm" dir="rtl">
            <p className="font-semibold text-red-800 mb-1">
              ⚠ {ads.flaggedPlacements.map((p) => p.placement).join("، ")} — مواضع معروفة بالليدز الوهمية
            </p>
            <p className="text-red-700">
              الحل: <strong>Ads Manager → Ad Set → Edit → Placements → Manual Placements</strong> → أزل هذه المواضع.
            </p>
          </div>
        )}
      </div>
    </Card>
  );
}

function CostCard({
  label, labelAr, value, bad, highlight,
}: {
  label: string; labelAr: string; value: string | number; bad?: boolean; highlight?: boolean;
}) {
  return (
    <div className={`rounded-xl px-3 py-3 text-center ${highlight ? "bg-indigo-50 border border-indigo-100" : bad ? "bg-red-50" : "bg-slate-50"}`}>
      <div className={`text-2xl font-bold ${highlight ? "text-brand" : bad ? "text-red-600" : "text-slate-800"}`}>
        {value}
      </div>
      <div className="text-[11px] text-slate-400 mt-0.5">{label}</div>
      <div className="text-[11px] text-slate-400" dir="rtl">{labelAr}</div>
    </div>
  );
}

// ── 6. Product Table ──────────────────────────────────────────────────────
function ProductTable({ seller }: { seller: SellerFacts }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-slate-400">
            <th className="py-2">Product</th>
            <th>Rate</th>
            <th>Confirmed</th>
            <th>Cancelled</th>
            <th>Open</th>
          </tr>
        </thead>
        <tbody>
          {seller.products.map((p) => (
            <tr key={p.productId} className="border-b last:border-0">
              <td className="py-2 pr-2">{p.productName}</td>
              <td><span className="font-semibold" style={{ color: rateColor(p.confirmationRate) }}>{p.confirmationRate}%</span></td>
              <td>{p.confirmed}</td>
              <td>{p.cancelled}</td>
              <td>{p.open}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── 7. Next Week Plan (Stop / Improve / Test) ─────────────────────────────
function NextWeekPlan({ seller }: { seller: SellerFacts }) {
  const stop = seller.recommendations.filter((r) => r.actionType === "stop");
  const improve = seller.recommendations.filter((r) => r.actionType === "improve");
  const test = seller.recommendations.filter((r) => r.actionType === "test");

  const Section = ({
    type, items, color, icon,
  }: {
    type: string; items: typeof stop; color: string; icon: string;
  }) => {
    if (items.length === 0) return null;
    return (
      <div>
        <div className={`mb-2 flex items-center gap-2 text-sm font-bold uppercase tracking-wide ${color}`}>
          <span>{icon}</span>
          <span>{type}</span>
        </div>
        <ul className="space-y-2">
          {items.map((r, i) => (
            <li key={i} className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
              <div className="font-medium text-ink text-sm">{r.titleEn}</div>
              <div className="text-sm text-slate-500 mt-0.5" dir="rtl">{r.titleAr}</div>
              <div className="mt-1 text-xs text-slate-400">{r.evidence}</div>
            </li>
          ))}
        </ul>
      </div>
    );
  };

  if (seller.recommendations.length === 0) return null;

  return (
    <Card title="خطة الأسبوع القادم" subtitle="Next week plan — Stop · Improve · Test">
      <div className="space-y-5">
        <Section type="Stop" items={stop} color="text-red-600" icon="🛑" />
        <Section type="Improve" items={improve} color="text-amber-600" icon="🔧" />
        <Section type="Test" items={test} color="text-emerald-600" icon="🧪" />
      </div>
    </Card>
  );
}

// ── 8. AI Diagnosis ───────────────────────────────────────────────────────
function Diagnosis({ seller }: { seller: SellerFacts }) {
  const [n, setN] = useState<Narrative | null>(null);
  const [loading, setLoading] = useState(true);
  const key = useMemo(() => seller.store, [seller]);

  useEffect(() => {
    let live = true;
    setLoading(true);
    setN(null);
    fetch("/api/interpret", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(seller),
    })
      .then((r) => r.json())
      .then((d) => live && setN(d))
      .catch(() => live && setN(null))
      .finally(() => live && setLoading(false));
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (loading) return <p className="text-sm text-slate-400">Generating diagnosis…</p>;
  if (!n) return <p className="text-sm text-bad">Could not generate diagnosis.</p>;

  return (
    <div className="space-y-4">
      <span className={`inline-block rounded-md px-2 py-0.5 text-[11px] font-medium ${n.source === "ai" ? "bg-indigo-50 text-brand" : "bg-slate-100 text-slate-500"}`}>
        {n.source === "ai" ? "AI interpretation" : "Deterministic summary"} ·{" "}
        {n.guardrail.violations.length === 0
          ? `${n.guardrail.checked} numbers verified`
          : `${n.guardrail.violations.length} rejected → fell back`}
      </span>
      <p className="leading-relaxed text-slate-700">{n.en}</p>
      <p className="leading-relaxed text-slate-700 ar" dir="rtl">{n.ar}</p>
    </div>
  );
}
