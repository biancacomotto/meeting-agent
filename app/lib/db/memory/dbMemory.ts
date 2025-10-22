/* eslint-disable @typescript-eslint/no-explicit-any */
import prisma from "../prisma";

type Msg = { role: "user" | "assistant"; content: string; ts: number };
const HISTORY_LIMIT = 12;

export async function getCustomerState(
  customerId: string
): Promise<Record<string, any>> {
  const row = await prisma.customerMemory.findUnique({ where: { customerId } });
  return (row?.stateJson as any) ?? {};
}

export async function upsertCustomerState(
  customerId: string,
  patch: Record<string, any>
) {
  const prev = await getCustomerState(customerId);
  const next = { ...prev, ...patch };
  await prisma.customerMemory.upsert({
    where: { customerId },
    create: { customerId, stateJson: next },
    update: { stateJson: next },
  });
}

export async function getConversationHistory(
  conversationId: string
): Promise<Msg[]> {
  const row = await prisma.conversationMemory.findUnique({
    where: { conversationId },
  });
  return (row?.historyJson as any) ?? [];
}

export async function appendConversationHistory(
  conversationId: string,
  customerId: string,
  messages: Msg[]
) {
  const old = await getConversationHistory(conversationId);
  const trimmed = [...old, ...messages].slice(-HISTORY_LIMIT);
  await prisma.conversationMemory.upsert({
    where: { conversationId },
    create: { conversationId, customerId, historyJson: trimmed },
    update: { historyJson: trimmed },
  });
}
