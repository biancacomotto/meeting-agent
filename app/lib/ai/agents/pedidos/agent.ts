import {
  PedidosTaskInput,
  PedidosTaskOutput,
} from "@/app/lib/ai/orchestrator/types";

export async function runPedidos(
  input: PedidosTaskInput
): Promise<PedidosTaskOutput> {
  return {
    status: "needs_clarification",
    items: input.items,
    etaMinutes: undefined,
    issues: ["Agente de pedidos pendiente de implementación"],
    confirmationMessage:
      "Recibimos tu pedido, estamos terminando de configurar este agente.",
  };
}
