import "server-only";

import { runReservas } from "./agents/reservas/agent";

// Wrapper kept for backward compatibility with the previous import path.
export async function restaurantAgent(
  conversationId: string,
  message: string
) {
  return runReservas({ conversationId, message });
}
