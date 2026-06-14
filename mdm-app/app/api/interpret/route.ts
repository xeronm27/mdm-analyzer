import { NextRequest, NextResponse } from "next/server";
import { interpret } from "@/lib/ai";
import type { SellerFacts } from "@/lib/engine/index";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  try {
    const seller = (await req.json()) as SellerFacts;
    const narrative = await interpret(seller);
    return NextResponse.json(narrative);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to interpret." },
      { status: 500 }
    );
  }
}
