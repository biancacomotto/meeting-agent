/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { restaurantAgent } from "@/app/lib/ai/restaurantAgent";
import { runAllTasks } from "@/app/lib/ai/orchestrator/runTasks";
import { OrchestratorInput } from "@/app/lib/ai/orchestrator/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { conversation_id, message, tasks, timeouts } = await req.json();

    if (tasks && typeof tasks === "object") {
      const orchestratorInput: OrchestratorInput = {
        reservas:
          tasks.reservas ??
          (conversation_id && message
            ? { conversationId: conversation_id, message }
            : undefined),
        pedidos: tasks.pedidos,
        precios: tasks.precios,
      };

      if (tasks.reservas && !orchestratorInput.reservas) {
        throw new Error(
          "reservas requiere conversation_id y message como fallback o payload propio"
        );
      }

      const orchestratedResult = await runAllTasks(orchestratorInput, {
        timeouts,
      });

      return NextResponse.json({
        ok: true,
        mode: "orchestrated",
        results: orchestratedResult,
      });
    }

    if (!conversation_id || !message)
      throw new Error("conversation_id y message son requeridos");

    const result = await restaurantAgent(conversation_id, message);

    return NextResponse.json({ ok: true, mode: "single", ...result });
  } catch (err: any) {
    console.error("[/api/ai/ask] error:", err);
    return NextResponse.json(
      { ok: false, error: err?.message ?? "Unhandled error" },
      { status: 400 }
    );
  }
}
