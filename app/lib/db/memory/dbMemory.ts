/* eslint-disable @typescript-eslint/no-explicit-any */

type Msg = { role: "user" | "assistant"; content: string; ts: number };

const HISTORY_LIMIT = 12;

// Estado en memoria
const customerStateById = new Map<string, Record<string, any>>();
const conversationById = new Map<string, Msg[]>();

export async function getCustomerState(
  customerId: string
): Promise<Record<string, any>> {
  return customerStateById.get(customerId) ?? {};
}

export async function upsertCustomerState(
  customerId: string,
  patch: Record<string, any>
) {
  const prev = await getCustomerState(customerId);
  const next = { ...prev, ...patch };
  customerStateById.set(customerId, next);
}

export async function getConversationHistory(
  conversationId: string
): Promise<Msg[]> {
  return conversationById.get(conversationId) ?? [];
}

export async function appendConversationHistory(
  conversationId: string,
  _customerId: string,
  messages: Msg[]
) {
  const old = await getConversationHistory(conversationId);
  const trimmed = [...old, ...messages].slice(-HISTORY_LIMIT);
  conversationById.set(conversationId, trimmed);
}
