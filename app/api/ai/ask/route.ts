/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { runAllTasks } from "@/app/lib/ai/orchestrator/runTasks";
import { routeToTasks } from "@/app/lib/ai/orchestrator/router";
import {
  OrchestratorResult,
  PedidosTaskOutput,
  PreciosTaskOutput,
  ReservasTaskOutput,
  TaskResult,
} from "@/app/lib/ai/orchestrator/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const formatReservas = (output?: ReservasTaskOutput): string | null => {
  if (!output) return null;
  if (output.rawReply) return output.rawReply;

  const parts = [];
  if (output.status) parts.push(`Estado: ${output.status}`);
  if (output.slot) parts.push(`Horario: ${output.slot}`);
  if (output.partySize) parts.push(`Personas: ${output.partySize}`);
  if (output.name) parts.push(`A nombre de: ${output.name}`);
  if (output.notes) parts.push(`Notas: ${output.notes}`);

  return parts.length ? parts.join(" | ") : null;
};

const formatPedidos = (output?: PedidosTaskOutput): string | null => {
  if (!output) return null;
  if (output.confirmationMessage) return output.confirmationMessage;

  const items =
    output.items && output.items.length > 0
      ? output.items
          .map((it) => `${it.quantity}x ${it.name}${it.notes ? ` (${it.notes})` : ""}`)
          .join(", ")
      : null;

  const eta =
    output.status === "received" && output.etaMinutes != null
      ? `ETA: ${output.etaMinutes} minutos`
      : null;

  const issues =
    output.issues && output.issues.length > 0
      ? `Necesito confirmar: ${output.issues.join("; ")}`
      : null;

  const parts = [items, eta, issues].filter(Boolean);
  return parts.length ? parts.join(" | ") : null;
};

const formatPrecios = (output?: PreciosTaskOutput): string | null => {
  if (!output || !Array.isArray(output) || output.length === 0) return null;
  const lines = output.map(
    (p) =>
      `${p.name}: ${p.currentPrice} -> ${p.newPrice}${
        p.suggestedFrom ? ` desde ${p.suggestedFrom}` : ""
      }${p.suggestedUntil ? ` hasta ${p.suggestedUntil}` : ""} (${p.rationale})`
  );
  return `Ajustes sugeridos: ${lines.join(" | ")}`;
};

const buildContent = (result: OrchestratorResult): string => {
  const sections: Array<string | null> = [];

  const addSection = (label: string, task: TaskResult<unknown>, text: string | null) => {
    if (task.status === "ok" && text) {
      sections.push(`${label}: ${text}`);
    } else if (task.status === "timeout") {
      sections.push(`${label}: sin respuesta (timeout)`);
    } else if (task.status === "error" && task.error) {
      sections.push(`${label}: error - ${task.error}`);
    }
  };

  addSection("Reservas", result.reservas, formatReservas(result.reservas.output));
  addSection("Pedidos", result.pedidos, formatPedidos(result.pedidos.output));
  addSection("Precios", result.precios, formatPrecios(result.precios.output));

  if (sections.length === 0) {
    return "No hay novedades por ahora, ¿querés intentar de nuevo?";
  }

  return sections.join(" || ");
};

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();
    const batch = Array.isArray(payload) ? payload : [payload];

    const results = [];

    for (const entry of batch) {
      const conversationId =
        entry?.conversation_id ?? entry?.conversationId ?? null;
      const message = entry?.message ?? null;
      const timeouts = entry?.timeouts;

      if (!conversationId || !message) {
        throw new Error(
          "Cada item debe incluir conversation_id y message"
        );
      }

      const orchestratorInput = await routeToTasks(conversationId, message);
      const orchestratedResult = await runAllTasks(orchestratorInput, {
        timeouts,
      });
      const content = buildContent(orchestratedResult);

      results.push({
        conversation_id: conversationId,
        chatwoot_id: entry?.chatwoot_id ?? entry?.chatwootId,
        content,
        results: orchestratedResult,
      });
    }

    return NextResponse.json({ ok: true, mode: "auto", batch: results });
  } catch (err: any) {
    console.error("[/api/ai/ask] error:", err);
    return NextResponse.json(
      { ok: false, error: err?.message ?? "Unhandled error" },
      { status: 400 }
    );
  }
}
