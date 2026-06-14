# MDM Express — Confirmation Analyzer

Internal tool. Upload a merchant's orders export (and optionally the Facebook ads
report); the deterministic engine computes the real confirmation rate and a
diagnosis, and the AI layer explains it in Arabic + English. **Code computes every
number; AI only interprets — it can never invent a figure.**

## Architecture
- `lib/engine/` — deterministic engine (mapping, cleaning, rate, reason→owner
  classification, ads aggregation, rule-based recommendations). Pure, testable.
- `lib/ai.ts` — Stage 2 AI interpretive layer + **numeric guardrail** (rejects any
  number not in the facts) + deterministic fallback.
- `app/api/analyze` — parses the .xlsx files and runs the engine → `facts`.
- `app/api/interpret` — turns one seller's facts into the bilingual narrative.
- `components/Report.tsx` — animated report (Recharts + Framer Motion).

## Run locally
```bash
npm install
cp .env.example .env.local   # optionally add ANTHROPIC_API_KEY
npm run dev                   # http://localhost:3000
```

## Deploy to Vercel
Push to a Git repo, import in Vercel, add `ANTHROPIC_API_KEY` (optional) as an
environment variable. No other config needed.

## PDF
The web report is animated; the **PDF is a static snapshot**. Click **Download PDF**
→ the browser's print dialog → Save as PDF. (A server-rendered PDF via Puppeteer can
be added later if a no-dialog download is required.)

## Data notes (from real exports)
- Market: Libya. Confirmation rate = `confirmed / (confirmed + cancelled)`;
  `not-answer` and `pending` are an open/recoverable bucket, excluded.
- Orders and the FB report share **no row-level key**, so per-placement attribution
  is aggregate-only until a UTM/placement param is captured on the landing page.
