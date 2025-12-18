/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { orchestrateWithSubAgents } from "@/app/lib/ai/orchestrator/router";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();
    const batch = Array.isArray(payload) ? payload : [payload];

    const results = [];

    for (const entry of batch) {
      const conversationId =
        entry?.conversation_id ?? entry?.conversationId ?? null;
      const message = entry?.message ?? null;

      if (!conversationId || !message) {
        throw new Error("Cada item debe incluir conversation_id y message");
      }

      const { content, usedAgents } = await orchestrateWithSubAgents(
        conversationId,
        message
      );

      results.push({
        conversation_id: conversationId,
        chatwoot_id: entry?.chatwoot_id ?? entry?.chatwootId,
        content,
        agents: usedAgents,
      });
    }

    return NextResponse.json({ ok: true, mode: "subagents", batch: results });
  } catch (err: any) {
    console.error("[/api/ai/ask] error:", err);
    return NextResponse.json(
      { ok: false, error: err?.message ?? "Unhandled error" },
      { status: 400 }
    );
  }
}
