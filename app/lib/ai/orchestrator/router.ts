import "server-only";

import { ChatPromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import {
  OrchestratorInput,
  PedidoItem,
  PedidosTaskInput,
  PreciosTaskInput,
  ReservasTaskInput,
} from "./types";

const routerPrompt = ChatPromptTemplate.fromMessages([
  [
    "system",
    [
      "Sos un despachador de pedidos para un sistema multi-agente (reservas | pedidos | precios).",
      "Elegi el agente mas adecuado segun el mensaje del cliente.",
      "Solo completa un agente; el resto debe ir en null.",
      "Formato estrictamente JSON, sin texto extra:",
      '{{ "reservas": {{...}} | null, "pedidos": {{...}} | null, "precios": {{...}} | null }}',
      "Esquemas esperados:",
      '- reservas: {{ conversationId: string, message: string }}',
      '- pedidos: {{ orderId?: string, address?: string, notes?: string, items: [{{ name: string, quantity: number, notes?: string }}] }}',
      '- precios: {{ products: [{{ productId: string, name: string, currentPrice: number, currency?: string, cost?: number, demandSignal?: string, competitionPrice?: number, notes?: string }}], context?: {{ costs?: string, demand?: string, competition?: string, notes?: string }} }}',
      "Si no hay datos suficientes para un agente, elegi el que mejor encaje pero completa lo minimo con lo que tengas y deja el resto en null.",
    ].join("\n"),
  ],
  [
    "human",
    [
      "ID conversacion: {conversationId}",
      "Mensaje: {message}",
      "Recordatorio: responde solo el JSON pedido.",
    ].join("\n"),
  ],
]);

const routerModel = new ChatGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_API_KEY ?? "your-google-api-key",
  model: "gemini-2.5-flash",
  temperature: 0.2,
});

const routerChain = routerPrompt.pipe(routerModel).pipe(new StringOutputParser());

const cleanJson = (raw: string): string => {
  const trimmed = raw.trim();
  if (trimmed.startsWith("```")) {
    return trimmed.replace(/^```json\s*/i, "").replace(/```$/, "").trim();
  }
  return trimmed;
};

const normalizeReservas = (
  parsed: unknown,
  defaults: ReservasTaskInput
): ReservasTaskInput => ({
  conversationId:
    parsed && typeof parsed === "object" && "conversationId" in parsed
      ? String((parsed as Record<string, unknown>).conversationId ?? defaults.conversationId)
      : defaults.conversationId,
  message:
    parsed && typeof parsed === "object" && "message" in parsed
      ? String((parsed as Record<string, unknown>).message ?? defaults.message)
      : defaults.message,
});

const normalizePedidos = (
  parsed: unknown
): PedidosTaskInput | undefined => {
  if (!parsed || typeof parsed !== "object") return undefined;
  const candidate = parsed as Record<string, unknown>;

  const itemsRaw = Array.isArray(candidate.items) ? candidate.items : [];
  const items: PedidoItem[] = [];
  if (itemsRaw.length > 0) {
    for (const it of itemsRaw) {
      if (!it || typeof it !== "object" || !("name" in it)) continue;
      const typed = it as Record<string, unknown>;
      const quantity =
        typeof typed.quantity === "number" && typed.quantity > 0
          ? Math.round(typed.quantity)
          : 1;
      items.push({
        id: typed.id ? String(typed.id) : undefined,
        name: String(typed.name),
        quantity,
        notes: typed.notes ? String(typed.notes) : undefined,
      });
    }
  }

  if (items.length === 0) return undefined;

  return {
    orderId: candidate.orderId ? String(candidate.orderId) : undefined,
    address: candidate.address ? String(candidate.address) : undefined,
    notes: candidate.notes ? String(candidate.notes) : undefined,
    items,
  };
};

const normalizePrecios = (parsed: unknown): PreciosTaskInput | undefined => {
  if (!parsed || typeof parsed !== "object") return undefined;
  const candidate = parsed as Record<string, unknown>;
  if (!Array.isArray(candidate.products) || candidate.products.length === 0)
    return undefined;

  const products = candidate.products.map((p: unknown) => {
    if (!p || typeof p !== "object") return null;
    const prod = p as Record<string, unknown>;
    return {
      productId: String(prod?.productId ?? prod?.id ?? ""),
      name: String(prod?.name ?? ""),
      currentPrice: Number(prod?.currentPrice ?? 0),
      currency: prod?.currency ? String(prod.currency) : undefined,
      cost: prod?.cost != null ? Number(prod.cost) : undefined,
      demandSignal: prod?.demandSignal ? String(prod.demandSignal) : undefined,
      competitionPrice:
        prod?.competitionPrice != null ? Number(prod.competitionPrice) : undefined,
      notes: prod?.notes ? String(prod.notes) : undefined,
    };
  }).filter((v): v is NonNullable<typeof v> => !!v);

  const context =
    candidate?.context && typeof candidate.context === "object"
      ? (() => {
          const ctx = candidate.context as Record<string, unknown>;
          return {
            costs: ctx.costs as string | undefined,
            demand: ctx.demand as string | undefined,
            competition: ctx.competition as string | undefined,
            notes: ctx.notes as string | undefined,
          };
        })()
      : undefined;

  return { products, context };
};

export async function routeToTasks(
  conversationId: string,
  message: string
): Promise<OrchestratorInput> {
  try {
    const raw = await routerChain.invoke({ conversationId, message });
    const cleaned = cleanJson(raw);
    const parsed = JSON.parse(cleaned);

    const reservas =
      parsed?.reservas != null
        ? normalizeReservas(parsed.reservas, { conversationId, message })
        : undefined;

    const pedidos = normalizePedidos(parsed?.pedidos);
    const precios = normalizePrecios(parsed?.precios);

    if (reservas || pedidos || precios) {
      return { reservas, pedidos, precios };
    }
  } catch {
    // fall through to default
  }

  return { reservas: { conversationId, message } };
}
