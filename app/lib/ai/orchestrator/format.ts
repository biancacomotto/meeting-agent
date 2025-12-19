import {
  CartaTaskOutput,
  PedidosTaskOutput,
  PreciosTaskOutput,
  ReservasTaskOutput,
} from "@/app/lib/ai/orchestrator/types";

const looksLikeJson = (value?: string): boolean => {
  if (!value) return false;
  const trimmed = value.trim();
  return (
    trimmed.startsWith("{") ||
    trimmed.startsWith("[") ||
    trimmed.startsWith("```") ||
    /^[{[]/.test(trimmed)
  );
};

export const formatReservasResponse = (
  output?: ReservasTaskOutput
): string | null => {
  if (!output) return null;

  const { rawReply } = output;
  if (rawReply && !looksLikeJson(rawReply)) return rawReply.trim();

  const parts: string[] = [];
  if (output.status) parts.push(`Estado: ${output.status}`);
  if (output.slot) parts.push(`Horario: ${output.slot}`);
  if (output.partySize) parts.push(`Personas: ${output.partySize}`);
  if (output.name) parts.push(`A nombre de: ${output.name}`);
  if (output.notes) parts.push(`Notas: ${output.notes}`);

  if (parts.length > 0) {
    return `Asi queda la reserva: ${parts.join(" | ")}. Avisame si queres cambiar algo.`;
  }

  return "Necesito algunos datos mas para reservar. Podes pasar fecha, horario y cuantas personas son?";
};

export const formatPedidosResponse = (
  output?: PedidosTaskOutput
): string | null => {
  if (!output) return null;

  if (output.confirmationMessage && !looksLikeJson(output.confirmationMessage)) {
    return output.confirmationMessage.trim();
  }

  const itemsText =
    output.items && output.items.length > 0
      ? output.items
          .map(
            (it) => `${it.quantity ?? 1}x ${it.name}${it.notes ? ` (${it.notes})` : ""}`
          )
          .join(", ")
      : null;

  const etaText =
    output.status === "received" && output.etaMinutes != null
      ? `ETA estimada: ${output.etaMinutes} minutos`
      : null;

  const issuesText =
    output.issues && output.issues.length > 0
      ? `Necesito confirmar: ${output.issues.join("; ")}`
      : null;

  const parts = [itemsText, etaText, issuesText].filter(Boolean);
  if (parts.length > 0) {
    return parts.join(" | ");
  }

  return "Recibi el pedido pero me faltan datos. Podes confirmar items, cantidades y direccion?";
};

export const formatPreciosResponse = (
  output?: PreciosTaskOutput
): string | null => {
  if (!output || output.length === 0) return null;

  const lines = output.map((p) => {
    const window =
      p.suggestedFrom || p.suggestedUntil
        ? ` (${p.suggestedFrom ?? "desde ahora"} - ${p.suggestedUntil ?? "sin fin"})`
        : "";
    return `${p.name}: ${p.currentPrice} -> ${p.newPrice}${window}. Motivo: ${p.rationale}`;
  });

  return `Propuestas de precio: ${lines.join(" | ")}`;
};

export const formatCartaResponse = (
  output?: CartaTaskOutput
): string | null => {
  if (!output) return null;
  const suffix = output.count > 0 ? ` (${output.count} productos)` : "";
  return `Te dejo la carta aca: ${output.link}${suffix}.`;
};
