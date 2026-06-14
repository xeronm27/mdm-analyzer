// ---------------------------------------------------------------------------
// Stage 2 — AI interpretive layer.
//
// CORE PRINCIPLE: the AI may only INTERPRET the facts. It is never allowed to
// invent or alter a number. Enforcement is in two layers:
//   1. The prompt forbids new numbers and is given the facts as the only source.
//   2. A post-generation guardrail extracts every number from the AI output and
//      rejects the response if any number is not present in the facts.
// If no API key is set, or the guardrail rejects the output, we fall back to a
// deterministic template narrative (numbers guaranteed correct) so the app
// always returns a valid, trustworthy report.
// ---------------------------------------------------------------------------

import type { SellerFacts } from "./engine/index";
import { OWNER_LABEL } from "./engine/classify";

export interface Narrative {
  source: "ai" | "deterministic";
  en: string;
  ar: string;
  guardrail: { checked: number; violations: string[] };
}

// ---- collect every allowed number from a seller's facts --------------------
function allowedNumbers(s: SellerFacts): Set<string> {
  const nums = new Set<string>();
  const add = (n: unknown) => {
    if (typeof n === "number" && Number.isFinite(n)) {
      nums.add(String(n));
      nums.add(String(Math.round(n)));
    }
  };
  add(s.rawConfirmationRate);
  add(s.confirmationRate);
  add(s.vsBenchmark);
  add(s.orders);
  add(s.confirmed);
  add(s.cancelled);
  add(s.open);
  add(s.notAnswer);
  add(s.pending);
  add(s.removedDuplicates);
  add(s.suspectedDuplicates);
  add(s.invalidPhones);
  add(s.decided);
  s.failuresByOwner.forEach((f) => {
    add(f.count);
    add(f.share);
  });
  s.products.forEach((p) => {
    add(p.confirmationRate);
    add(p.confirmed);
    add(p.cancelled);
    add(p.open);
  });
  return nums;
}

// extract numeric tokens from generated prose
function extractNumbers(text: string): string[] {
  return (text.match(/\d+(?:\.\d+)?/g) ?? []).filter((n) => {
    const v = Number(n);
    return v >= 10 || n.includes("."); // ignore trivial 0-9 counts ("3 attempts")
  });
}

function runGuardrail(text: string, allowed: Set<string>) {
  const found = extractNumbers(text);
  const violations = found.filter((n) => {
    if (allowed.has(n)) return true; // exact
    // tolerance: allow rounded match (e.g. 49 vs 49.1)
    const v = Number(n);
    for (const a of allowed) {
      if (Math.abs(Number(a) - v) < 0.6) return true;
    }
    return false;
  });
  // violations = numbers NOT matched
  const bad = found.filter((n) => !violations.includes(n));
  return { checked: found.length, violations: bad };
}

// ---- deterministic narrative (template, always numerically correct) --------
export function deterministicNarrative(s: SellerFacts): Narrative {
  const topFew = s.failuresByOwner
    .filter((f) => f.owner !== "uncategorized")
    .slice(0, 3);
  const ownerEn = (o: string) =>
    o === "uncategorized" ? "Uncategorized" : (OWNER_LABEL as any)[o].en;
  const ownerAr = (o: string) =>
    o === "uncategorized" ? "غير مصنّف" : (OWNER_LABEL as any)[o].ar;

  const en = [
    `Seller "${s.store}" has a real confirmation rate of ${s.confirmationRate}% (it was ${s.rawConfirmationRate}% before removing ${s.removedDuplicates} duplicate orders that were distorting the picture).`,
    `Out of ${s.orders} orders, ${s.confirmed} were confirmed and ${s.cancelled} cancelled, with ${s.open} still open and recoverable (${s.notAnswer} no-answer, ${s.pending} pending).`,
    topFew.length
      ? `The main drivers of lost orders are: ${topFew
          .map((f) => `${ownerEn(f.owner)} (${f.share}%)`)
          .join(", ")}.`
      : "",
    s.recommendations.length
      ? `Top action: ${s.recommendations[0].titleEn} — ${s.recommendations[0].evidence}`
      : "",
  ]
    .filter(Boolean)
    .join(" ");

  const ar = [
    `معدّل التأكيد الحقيقي للتاجر "${s.store}" هو ${s.confirmationRate}% (كان ${s.rawConfirmationRate}% قبل إزالة ${s.removedDuplicates} طلباً مكرراً كانت تشوّه الصورة).`,
    `من أصل ${s.orders} طلباً، تم تأكيد ${s.confirmed} وإلغاء ${s.cancelled}، مع ${s.open} طلباً ما زال مفتوحاً وقابلاً للاسترجاع (${s.notAnswer} بدون رد، ${s.pending} قيد الانتظار).`,
    topFew.length
      ? `أهم أسباب فقدان الطلبات: ${topFew
          .map((f) => `${ownerAr(f.owner)} (${f.share}%)`)
          .join("، ")}.`
      : "",
    s.recommendations.length
      ? `الإجراء الأهم: ${s.recommendations[0].titleAr}.`
      : "",
  ]
    .filter(Boolean)
    .join(" ");

  return {
    source: "deterministic",
    en,
    ar,
    guardrail: { checked: 0, violations: [] },
  };
}

// ---- AI narrative (with guardrail + fallback) ------------------------------
export async function interpret(s: SellerFacts): Promise<Narrative> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return deterministicNarrative(s);

  try {
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const client = new Anthropic({ apiKey: key });

    const factsForModel = JSON.stringify(
      {
        store: s.store,
        rawConfirmationRate: s.rawConfirmationRate,
        confirmationRate: s.confirmationRate,
        vsBenchmark: s.vsBenchmark,
        orders: s.orders,
        confirmed: s.confirmed,
        cancelled: s.cancelled,
        open: s.open,
        notAnswer: s.notAnswer,
        pending: s.pending,
        removedDuplicates: s.removedDuplicates,
        failuresByOwner: s.failuresByOwner,
        products: s.products.map((p) => ({
          name: p.productName,
          rate: p.confirmationRate,
          confirmed: p.confirmed,
          cancelled: p.cancelled,
        })),
        recommendations: s.recommendations,
      },
      null,
      2
    );

    const prompt = `You are an analyst for MDM Express, a cash-on-delivery fulfilment platform in Libya. You will receive a JSON object of FACTS that were computed precisely by code about one seller's order-confirmation performance.

STRICT RULES:
- You may ONLY use numbers that appear in the FACTS. Never invent, estimate, round into a new figure, or compute a new number.
- Interpret and explain; do not recalculate.
- Write two versions: clear professional English, then Modern Standard Arabic.
- Be concise (4-6 sentences each). Explain what the problem is, who is responsible, and what to do first.

FACTS:
${factsForModel}

Respond as JSON: {"en": "...", "ar": "..."}`;

    const msg = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    });

    const text = msg.content
      .map((c) => (c.type === "text" ? c.text : ""))
      .join("");
    const parsed = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1));

    const allowed = allowedNumbers(s);
    const gEn = runGuardrail(parsed.en ?? "", allowed);
    const gAr = runGuardrail(parsed.ar ?? "", allowed);
    const violations = [...gEn.violations, ...gAr.violations];

    if (violations.length > 0) {
      // AI tried to use a number not in the facts -> reject, fall back
      const det = deterministicNarrative(s);
      det.guardrail = {
        checked: gEn.checked + gAr.checked,
        violations,
      };
      return det;
    }

    return {
      source: "ai",
      en: parsed.en ?? "",
      ar: parsed.ar ?? "",
      guardrail: { checked: gEn.checked + gAr.checked, violations: [] },
    };
  } catch {
    return deterministicNarrative(s);
  }
}
