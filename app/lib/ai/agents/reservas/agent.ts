import {
  ReservasTaskInput,
  ReservasTaskOutput,
} from "@/app/lib/ai/orchestrator/types";

// TODO: replace stub with real reservas agent implementation (LLM + tools)
export async function runReservas(
  input: ReservasTaskInput
): Promise<ReservasTaskOutput> {
  return {
    status: "unavailable",
    rawReply:
      "Agente de reservas pendiente de implementación. Mensaje recibido: " +
      input.message,
  };
}
