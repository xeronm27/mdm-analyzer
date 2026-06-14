"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { Facts, SellerFacts } from "@/lib/engine/index";
import type { Narrative } from "@/lib/ai";
import { Report } from "@/components/Report";

export default function Home() {
  const [orders, setOrders] = useState<File | null>(null);
  const [ads, setAds] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [facts, setFacts] = useState<Facts | null>(null);

  async function run() {
    if (!orders) return;
    setLoading(true);
    setError(null);
    setFacts(null);
    try {
      const fd = new FormData();
      fd.append("orders", orders);
      if (ads) fd.append("ads", ads);
      const res = await fetch("/api/analyze", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Analysis failed");
      setFacts(data as Facts);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-5 py-10">
      <header className="mb-8 no-print">
        <h1 className="text-3xl font-bold text-ink">
          MDM Express · Confirmation Analyzer sellers
        </h1>
        <p className="mt-1 text-slate-500">
          Upload a merchant&apos;s orders export (and optionally the Facebook ads
          report). Code computes the facts; AI explains them.
        </p>
      </header>

      <section className="no-print grid gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:grid-cols-2">
        <FilePick
          label="Orders file (required)"
          hint="leads.xlsx — status & reason per order"
          file={orders}
          onPick={setOrders}
        />
        <FilePick
          label="Facebook ads report (optional)"
          hint="placement-level export"
          file={ads}
          onPick={setAds}
        />
        <div className="sm:col-span-2 flex items-center gap-3">
          <button
            onClick={run}
            disabled={!orders || loading}
            className="rounded-xl bg-brand px-5 py-2.5 font-semibold text-white shadow-sm transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {loading ? "Analyzing…" : "Analyze"}
          </button>
          {error && <span className="text-sm text-bad">{error}</span>}
        </div>
      </section>

      <AnimatePresence>
        {facts && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <Report facts={facts} />
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}

function FilePick({
  label,
  hint,
  file,
  onPick,
}: {
  label: string;
  hint: string;
  file: File | null;
  onPick: (f: File | null) => void;
}) {
  return (
    <label className="block cursor-pointer rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 transition hover:border-brand">
      <div className="font-medium text-ink">{label}</div>
      <div className="text-xs text-slate-400">{hint}</div>
      <div className="mt-2 truncate text-sm text-brand">
        {file ? file.name : "Choose .xlsx file…"}
      </div>
      <input
        type="file"
        accept=".xlsx,.xls,.csv"
        className="hidden"
        onChange={(e) => onPick(e.target.files?.[0] ?? null)}
      />
    </label>
  );
}

export type { Facts, SellerFacts, Narrative };
