/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { restaurantAgent } from "@/app/lib/ai/restaurantAgent";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { conversation_id, message } = await req.json();

    if (!conversation_id || !message)
      throw new Error("conversation_id y message son requeridos");

    const result = await restaurantAgent(conversation_id, message);

    return NextResponse.json({ ok: true, ...result });
  } catch (err: any) {
    console.error("[/api/ai/ask] error:", err);
    return NextResponse.json(
      { ok: false, error: err?.message ?? "Unhandled error" },
      { status: 400 }
    );
  }
}
