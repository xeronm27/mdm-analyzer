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

const OWNER_COLORS: Record<string, string> = {
  ads: "#6366f1",
  merchant: "#0ea5e9",
  product: "#14b8a6",
  us: "#f59e0b",
  customer: "#a855f7",
  uncategorized: "#94a3b8",
};
const OWNER_EN: Record<string, string> = {
  ads: "Ads",
  merchant: "Merchant",
  product: "Product",
  us: "MDM Express",
  customer: "Customer",
  uncategorized: "Uncategorized",
};

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
      <Header seller={seller} benchmark={facts.benchmark.confirmationRate} />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Real confirmation rate" subtitle="raw → cleaned (after removing duplicates)">
          <RateView seller={seller} />
        </Card>
        <Card title="Where orders are lost" subtitle="cancellations by responsible party">
          <FailureDonut seller={seller} />
        </Card>
      </div>

      {/* Facebook Lead Quality — always shown if FB file uploaded */}
      {facts.ads && <FacebookLeadQuality seller={seller} ads={facts.ads} />}

      <Card title="Per-product breakdown" subtitle="worst confirmation rate first">
        <ProductTable seller={seller} />
      </Card>
      <Card title="Recommendations" subtitle="rule-based, each with its evidence">
        <Recommendations seller={seller} />
      </Card>
      <Card title="AI diagnosis" subtitle="interpretation only — every number is verified against the facts">
        <Diagnosis seller={seller} />
      </Card>
    </div>
  );
}

// ── Header ────────────────────────────────────────────────────────────────
function Header({ seller, benchmark }: { seller: SellerFacts; benchmark: number | null }) {
  const vs = seller.vsBenchmark;
  const rating = getRating(seller.confirmationRate);
  return (
    <div className="print-block rounded-2xl bg-gradient-to-br from-brand to-indigo-700 p-6 text-white shadow">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-sm uppercase tracking-wide text-indigo-200">Seller</div>
          <div className="text-3xl font-bold">{seller.store}</div>
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
      <div className="mt-4 rounded-xl bg-white/10 px-4 py-3 text-sm text-indigo-50" dir="rtl">
        {rating.contextAr}
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
      <div className="mb-3">
        <h3 className="font-semibold text-ink">{title}</h3>
        {subtitle && <p className="text-xs text-slate-400">{subtitle}</p>}
      </div>
      {children}
    </motion.div>
  );
}

// ── Facebook Lead Quality Section ─────────────────────────────────────────
// Focus: how many fake/low-quality leads came through the ad funnel,
// and which placements are known sources of this problem.
function FacebookLeadQuality({ seller, ads }: { seller: SellerFacts; ads: AdsFacts }) {
  const fakeTotal = seller.fakeLeadTotal;
  const fakeShare = seller.fakeLeadShare;
  const hasFakeLeads = fakeTotal > 0;
  const hasFlaggedPlacements = ads.flaggedPlacements.length > 0;

  // Donut data for fake lead reasons
  const FAKE_COLORS = ["#dc2626", "#ef4444", "#f87171", "#fca5a5", "#fecaca"];
  const donutData = seller.fakeLeadReasons.map((r, i) => ({
    name: r.labelAr,
    nameEn: r.labelEn,
    value: r.count,
    share: r.share,
    color: FAKE_COLORS[i % FAKE_COLORS.length],
  }));

  return (
    <Card
      title="Facebook — Lead Quality Analysis"
      subtitle="تحليل جودة الليدز — الليدز الوهمية والمصادر المشبوهة"
    >
      {/* ── Overview strip ── */}
      <div className="mb-5 grid grid-cols-3 gap-3">
        <div className="rounded-xl bg-slate-50 px-3 py-3 text-center">
          <div className="text-2xl font-bold text-slate-800">{ads.totalResults}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Total leads</div>
          <div className="text-[11px] text-slate-400" dir="rtl">إجمالي الليدز</div>
        </div>
        <div className={`rounded-xl px-3 py-3 text-center ${hasFakeLeads ? "bg-red-50" : "bg-emerald-50"}`}>
          <div className={`text-2xl font-bold ${hasFakeLeads ? "text-red-600" : "text-emerald-600"}`}>
            {fakeTotal}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Fake / ghost leads</div>
          <div className="text-[11px] text-slate-400" dir="rtl">ليدز وهمية ({fakeShare}% من الإلغاءات)</div>
        </div>
        <div className={`rounded-xl px-3 py-3 text-center ${hasFlaggedPlacements ? "bg-amber-50" : "bg-emerald-50"}`}>
          <div className={`text-2xl font-bold ${hasFlaggedPlacements ? "text-amber-600" : "text-emerald-600"}`}>
            {hasFlaggedPlacements ? ads.flaggedPlacements.length : "✓"}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Risky placements</div>
          <div className="text-[11px] text-slate-400" dir="rtl">مواضع مشبوهة</div>
        </div>
      </div>

      {/* ── Fake lead reasons ── */}
      {hasFakeLeads ? (
        <div className="mb-5">
          <h4 className="text-sm font-semibold text-slate-700 mb-3">
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
                    <span className="text-slate-400 text-xs hidden sm:inline">· {r.labelEn}</span>
                  </span>
                  <span className="font-semibold text-red-600 ml-2">{r.count} ({r.share}%)</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : (
        <div className="mb-5 rounded-xl bg-emerald-50 border border-emerald-100 px-4 py-3 text-sm text-emerald-700" dir="rtl">
          ✓ لا توجد ليدز وهمية مكتشفة في هذه الدورة — جودة الليدز جيدة من ناحية المصدر.
        </div>
      )}

      {/* ── Placement risk table ── */}
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
                <th className="pb-2">Risk / الخطر</th>
                <th className="pb-2">Action / الإجراء</th>
              </tr>
            </thead>
            <tbody>
              {ads.byPlacement.filter(p => p.results > 0).map((p) => {
                const risk = p.flagged ? "high" : "low";
                return (
                  <tr key={p.placement} className="border-b last:border-0">
                    <td className="py-2 pr-3 font-medium text-slate-700">
                      {p.flagged && <span className="mr-1 text-amber-500">⚠</span>}
                      {p.placement}
                    </td>
                    <td className="py-2 text-slate-600">{p.results}</td>
                    <td className="py-2">
                      {risk === "high" ? (
                        <span className="inline-flex items-center rounded-md bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 ring-1 ring-red-200">
                          مرتفع — ليدز وهمية
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200">
                          منخفض ✓
                        </span>
                      )}
                    </td>
                    <td className="py-2 text-xs text-slate-500">
                      {p.flagged
                        ? "أوقفه في Ads Manager → Manual Placements"
                        : "استمر"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Flagged placement explanation */}
        {hasFlaggedPlacements && (
          <div className="mt-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm" dir="rtl">
            <p className="font-semibold text-red-800 mb-1">
              ⚠ {ads.flaggedPlacements.map(p => p.placement).join("، ")} — مواضع معروفة بالليدز الوهمية
            </p>
            <p className="text-red-700">
              هذه المواضع تجلب نقرات عرضية وغير مقصودة (أطفال، نقرات خاطئة، جمهور خارج الاستهداف).
              الحل: <strong>Ads Manager → Ad Set → Edit → Placements → Manual Placements</strong> → أزل هذه المواضع من القائمة.
            </p>
          </div>
        )}
      </div>
    </Card>
  );
}

// ── Rate bars ─────────────────────────────────────────────────────────────
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

// ── Failure donut ─────────────────────────────────────────────────────────
function FailureDonut({ seller }: { seller: SellerFacts }) {
  const data = seller.failuresByOwner.map((f) => ({
    name: OWNER_EN[f.owner] ?? f.owner,
    value: f.count, share: f.share,
    color: OWNER_COLORS[f.owner] ?? "#94a3b8",
  }));
  if (data.length === 0)
    return <p className="text-sm text-slate-400">No cancellations to break down.</p>;
  return (
    <div className="flex items-center gap-4">
      <div className="h-44 w-44 shrink-0">
        <ResponsiveContainer>
          <PieChart>
            <Pie data={data} dataKey="value" innerRadius={45} outerRadius={75} paddingAngle={2}>
              {data.map((d) => <Cell key={d.name} fill={d.color} />)}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="flex-1 space-y-1.5 text-sm">
        {data.map((d) => (
          <li key={d.name} className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <span className="inline-block h-3 w-3 rounded-sm" style={{ background: d.color }} />
              {d.name}
            </span>
            <span className="font-medium text-slate-600">{d.value} ({d.share}%)</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ── Product table ─────────────────────────────────────────────────────────
function ProductTable({ seller }: { seller: SellerFacts }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-slate-400">
            <th className="py-2">Product</th><th>Rate</th><th>Confirmed</th><th>Cancelled</th><th>Open</th>
          </tr>
        </thead>
        <tbody>
          {seller.products.map((p) => (
            <tr key={p.productId} className="border-b last:border-0">
              <td className="py-2 pr-2">{p.productName}</td>
              <td><span className="font-semibold" style={{ color: rateColor(p.confirmationRate) }}>{p.confirmationRate}%</span></td>
              <td>{p.confirmed}</td><td>{p.cancelled}</td><td>{p.open}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Recommendations ───────────────────────────────────────────────────────
function Recommendations({ seller }: { seller: SellerFacts }) {
  const tone: Record<string, string> = {
    high: "bg-red-50 text-bad ring-red-100",
    medium: "bg-amber-50 text-warn ring-amber-100",
    low: "bg-slate-50 text-slate-500 ring-slate-100",
  };
  if (seller.recommendations.length === 0)
    return <p className="text-sm text-slate-400">No issues flagged.</p>;
  return (
    <ul className="space-y-3">
      {seller.recommendations.map((r, i) => (
        <li key={i} className="flex gap-3">
          <span className={`mt-0.5 h-fit rounded-md px-2 py-0.5 text-[11px] font-bold uppercase ring-1 ${tone[r.priority]}`}>
            {r.priority}
          </span>
          <div>
            <div className="font-medium text-ink">{r.titleEn}</div>
            <div className="text-sm text-slate-500" dir="rtl">{r.titleAr}</div>
            <div className="mt-0.5 text-xs text-slate-400">{r.evidence}</div>
          </div>
        </li>
      ))}
    </ul>
  );
}

// ── AI diagnosis ──────────────────────────────────────────────────────────
function Diagnosis({ seller }: { seller: SellerFacts }) {
  const [n, setN] = useState<Narrative | null>(null);
  const [loading, setLoading] = useState(true);
  const key = useMemo(() => seller.store, [seller]);

  useEffect(() => {
    let live = true;
    setLoading(true); setN(null);
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
        {n.guardrail.violations.length === 0 ? `${n.guardrail.checked} numbers verified` : `${n.guardrail.violations.length} rejected → fell back`}
      </span>
      <p className="leading-relaxed text-slate-700">{n.en}</p>
      <p className="leading-relaxed text-slate-700 ar">{n.ar}</p>
    </div>
  );
}
