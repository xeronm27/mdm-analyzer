"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";
import type { Facts, SellerFacts } from "@/lib/engine/index";
import type { Narrative } from "@/lib/ai";

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
  us: "Us (Call Center)",
  customer: "Customer",
  uncategorized: "Uncategorized",
};

function rateColor(r: number | null) {
  if (r === null) return "#94a3b8";
  if (r >= 60) return "#16a34a";
  if (r >= 45) return "#d97706";
  return "#dc2626";
}

export function Report({ facts }: { facts: Facts }) {
  const [idx, setIdx] = useState(0);
  const seller = facts.sellers[idx];

  return (
    <div className="mt-8 space-y-6">
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {facts.sellers.map((s, i) => (
            <button
              key={s.store}
              onClick={() => setIdx(i)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                i === idx
                  ? "bg-brand text-white"
                  : "bg-white text-slate-600 ring-1 ring-slate-200 hover:ring-brand"
              }`}
            >
              {s.store} · {s.confirmationRate}%
            </button>
          ))}
        </div>
        <button
          onClick={() => window.print()}
          className="rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white hover:brightness-125"
        >
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

      {facts.ads && (
        <Card title="Facebook placements" subtitle="cost per result — ⚠ = low-quality placement">
          <PlacementBars facts={facts} />
        </Card>
      )}

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

function Header({
  seller,
  benchmark,
}: {
  seller: SellerFacts;
  benchmark: number | null;
}) {
  const vs = seller.vsBenchmark;
  return (
    <div className="print-block rounded-2xl bg-gradient-to-br from-brand to-indigo-700 p-6 text-white shadow">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-sm uppercase tracking-wide text-indigo-200">
            Seller
          </div>
          <div className="text-3xl font-bold">{seller.store}</div>
        </div>
        <div className="text-right">
          <div className="text-5xl font-extrabold">
            {seller.confirmationRate}
            <span className="text-2xl">%</span>
          </div>
          <div className="text-sm text-indigo-100">
            confirmation rate ·{" "}
            {vs === null
              ? "—"
              : `${vs >= 0 ? "+" : ""}${vs} pts vs benchmark ${benchmark}%`}
          </div>
        </div>
      </div>
    </div>
  );
}

function Card({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.35 }}
      className="print-block rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
    >
      <div className="mb-3">
        <h3 className="font-semibold text-ink">{title}</h3>
        {subtitle && <p className="text-xs text-slate-400">{subtitle}</p>}
      </div>
      {children}
    </motion.div>
  );
}

function RateView({ seller }: { seller: SellerFacts }) {
  const bars = [
    { label: "Raw", value: seller.rawConfirmationRate ?? 0, color: "#cbd5e1" },
    {
      label: "Cleaned",
      value: seller.confirmationRate ?? 0,
      color: rateColor(seller.confirmationRate),
    },
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
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${b.value}%` }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                className="h-full rounded-full"
                style={{ background: b.color }}
              />
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

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "good" | "bad" | "warn";
}) {
  const c =
    tone === "good"
      ? "text-good"
      : tone === "bad"
        ? "text-bad"
        : tone === "warn"
          ? "text-warn"
          : "text-slate-700";
  return (
    <div className="rounded-lg bg-slate-50 py-2">
      <div className={`text-xl font-bold ${c}`}>{value}</div>
      <div className="text-[11px] text-slate-400">{label}</div>
    </div>
  );
}

function FailureDonut({ seller }: { seller: SellerFacts }) {
  const data = seller.failuresByOwner.map((f) => ({
    name: OWNER_EN[f.owner] ?? f.owner,
    value: f.count,
    share: f.share,
    color: OWNER_COLORS[f.owner] ?? "#94a3b8",
  }));
  if (data.length === 0)
    return <p className="text-sm text-slate-400">No cancellations to break down.</p>;
  return (
    <div className="flex items-center gap-4">
      <div className="h-44 w-44 shrink-0">
        <ResponsiveContainer>
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              innerRadius={45}
              outerRadius={75}
              paddingAngle={2}
            >
              {data.map((d) => (
                <Cell key={d.name} fill={d.color} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="flex-1 space-y-1.5 text-sm">
        {data.map((d) => (
          <li key={d.name} className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <span
                className="inline-block h-3 w-3 rounded-sm"
                style={{ background: d.color }}
              />
              {d.name}
            </span>
            <span className="font-medium text-slate-600">
              {d.value} ({d.share}%)
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function PlacementBars({ facts }: { facts: Facts }) {
  const data = (facts.ads?.byPlacement ?? [])
    .filter((p) => p.results > 0)
    .map((p) => ({
      name: (p.flagged ? "⚠ " : "") + p.placement,
      cpr: p.costPerResult ?? 0,
      flagged: p.flagged,
    }));
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer>
        <BarChart data={data} layout="vertical" margin={{ left: 20, right: 20 }}>
          <XAxis type="number" tickFormatter={(v) => `$${v}`} />
          <YAxis type="category" dataKey="name" width={180} tick={{ fontSize: 11 }} />
          <Tooltip formatter={(v) => `$${v} / result`} />
          <Bar dataKey="cpr" radius={[0, 4, 4, 0]}>
            {data.map((d) => (
              <Cell key={d.name} fill={d.flagged ? "#dc2626" : "#6366f1"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

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
              <td>
                <span
                  className="font-semibold"
                  style={{ color: rateColor(p.confirmationRate) }}
                >
                  {p.confirmationRate}%
                </span>
              </td>
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
          <span
            className={`mt-0.5 h-fit rounded-md px-2 py-0.5 text-[11px] font-bold uppercase ring-1 ${tone[r.priority]}`}
          >
            {r.priority}
          </span>
          <div>
            <div className="font-medium text-ink">{r.titleEn}</div>
            <div className="text-sm text-slate-500" dir="rtl">
              {r.titleAr}
            </div>
            <div className="mt-0.5 text-xs text-slate-400">{r.evidence}</div>
          </div>
        </li>
      ))}
    </ul>
  );
}

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
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (loading)
    return <p className="text-sm text-slate-400">Generating diagnosis…</p>;
  if (!n) return <p className="text-sm text-bad">Could not generate diagnosis.</p>;

  return (
    <div className="space-y-4">
      <span
        className={`inline-block rounded-md px-2 py-0.5 text-[11px] font-medium ${
          n.source === "ai"
            ? "bg-indigo-50 text-brand"
            : "bg-slate-100 text-slate-500"
        }`}
      >
        {n.source === "ai" ? "AI interpretation" : "Deterministic summary"} ·{" "}
        {n.guardrail.violations.length === 0
          ? `${n.guardrail.checked} numbers verified`
          : `${n.guardrail.violations.length} rejected → fell back`}
      </span>
      <p className="leading-relaxed text-slate-700">{n.en}</p>
      <p className="leading-relaxed text-slate-700 ar">{n.ar}</p>
    </div>
  );
}
