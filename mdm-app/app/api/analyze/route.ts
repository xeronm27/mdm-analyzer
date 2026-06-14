import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { analyze } from "@/lib/engine/index";

export const runtime = "nodejs";

function parse(buf: ArrayBuffer): Record<string, unknown>[] {
  const wb = XLSX.read(buf, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json(ws, { defval: null });
}

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const orders = form.get("orders");
    const ads = form.get("ads");

    if (!(orders instanceof File)) {
      return NextResponse.json(
        { error: "An orders file is required." },
        { status: 400 }
      );
    }

    const orderRows = parse(await orders.arrayBuffer());
    const adsRows =
      ads instanceof File ? parse(await ads.arrayBuffer()) : undefined;

    const facts = analyze(orderRows, adsRows);
    return NextResponse.json(facts);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to analyze files." },
      { status: 500 }
    );
  }
}
