/* eslint-disable @typescript-eslint/no-explicit-any */
import "server-only";

import {
  BaseMessage,
  HumanMessage,
  SystemMessage,
} from "@langchain/core/messages";
import { DynamicStructuredTool } from "@langchain/core/tools";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import z from "zod";
import { runPedidos } from "@/app/lib/ai/agents/pedidos/agent";
import { runPrecios } from "@/app/lib/ai/agents/precios/agent";
import { runReservas } from "@/app/lib/ai/agents/reservas/agent";
import {
  PedidosTaskInput,
  PreciosTaskInput,
  ReservasTaskInput,
  TaskName,
} from "@/app/lib/ai/orchestrator/types";
import {
  formatPedidosResponse,
  formatPreciosResponse,
  formatReservasResponse,
} from "@/app/lib/ai/orchestrator/format";
import { MemorySaver } from "@langchain/langgraph";
import { retrieveContext } from "@/app/lib/ai/knowledge/retriever";

const routerModel = new ChatGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_API_KEY ?? "your-google-api-key",
  model: "gemini-2.5-flash",
  temperature: 0.2,
});

// Reusamos un checkpointer para que el nodo Agent conserve memoria por conversacion
const routerCheckpointer = new MemorySaver();
const routerThreads = new Set<string>();

const supervisorPrompt = [
  "Sos el nodo Agent principal de un flujo estilo n8n.",
  "Tenes tres Agent Tools: reservas, pedidos y precios. Elegi solo el que aplica y pasale los datos justos.",
  "Responde al cliente en texto simple y canchero (espanol rioplatense), sin JSON ni markdown.",
  "Si falta informacion, pedila en una sola pregunta concreta antes de accionar.",
  "No inventes datos: usa solo lo que recibis o lo que puedas inferir con mucha confianza.",
].join("\n");

const extractText = (message?: BaseMessage): string => {
  if (!message) return "";
  const content = (message as { content?: unknown }).content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part: unknown) => {
        if (typeof part === "string") return part;
        if (part && typeof part === "object" && "text" in part) {
          const val = (part as { text?: unknown }).text;
          return typeof val === "string" ? val : "";
        }
        return "";
      })
      .filter(Boolean)
      .join("\n");
  }
  return "";
};

type AgentToolNodeConfig<TInput, TOutput> = {
  task: TaskName;
  toolName: string;
  description: string;
  schema: z.ZodTypeAny;
  normalize: (input: unknown, conversationId?: string) => TInput;
  run: (input: TInput) => Promise<TOutput>;
  format: (output?: TOutput) => string | null;
  fallback: string;
};

const sanitizeReservasInput = (
  input: unknown,
  conversationId?: string
): ReservasTaskInput => {
  const typed = (input as { conversationId?: string; message?: string }) ?? {};
  return {
    conversationId: typed.conversationId ?? conversationId ?? "sin-id",
    message: (typed.message ?? "").trim(),
  };
};

const sanitizePedidosInput = (
  input: unknown,
  conversationId?: string
): PedidosTaskInput => {
  const typed = (input as {
    conversationId?: string;
    orderId?: string;
    address?: string;
    notes?: string;
    items?: Array<{
      id?: string;
      name?: string;
      quantity?: number;
      notes?: string;
    }>;
  }) ?? { items: [] };

  return {
    conversationId: typed.conversationId ?? conversationId,
    orderId: typed.orderId,
    address: typed.address,
    notes: typed.notes,
    items:
      typed.items?.map((item) => ({
        id: item.id,
        name: (item.name ?? "").trim(),
        quantity:
          item.quantity && item.quantity > 0 ? Math.round(item.quantity) : 1,
        notes: item.notes,
      })) ?? [],
  };
};

const sanitizePreciosInput = (
  input: unknown,
  conversationId?: string
): PreciosTaskInput => {
  const typed = (input as {
    conversationId?: string;
    context?: PreciosTaskInput["context"];
    products?: Array<{
      productId?: string;
      name: string;
      currentPrice: number;
      currency?: string;
      cost?: number;
      demandSignal?: string;
      competitionPrice?: number;
      notes?: string;
    }>;
  }) ?? { products: [] };

  return {
    conversationId: typed.conversationId ?? conversationId,
    context: typed.context,
    products:
      typed.products?.map((p) => ({
        productId: p.productId ?? p.name ?? "sin-id",
        name: p.name,
        currentPrice: p.currentPrice,
        currency: p.currency,
        cost: p.cost,
        demandSignal: p.demandSignal,
        competitionPrice: p.competitionPrice,
        notes: p.notes,
      })) ?? [],
  };
};

const agentToolNodes: Array<AgentToolNodeConfig<any, any>> = [
  {
    task: "reservas",
    toolName: "reservas_agent",
    description: "Agent Tool: gestiona reservas y disponibilidad de mesas.",
    schema: z.object({
      conversationId: z.string().describe("ID de la conversacion original"),
      message: z.string().describe("Mensaje completo del cliente para reservar"),
    }),
    normalize: sanitizeReservasInput,
    run: runReservas,
    format: (output) => formatReservasResponse(output),
    fallback:
      "No pude gestionar la reserva con los datos que tengo, podes confirmarlos?",
  },
  {
    task: "pedidos",
    toolName: "pedidos_agent",
    description: "Agent Tool: confirma pedidos, cantidades y direccion de entrega.",
    schema: z.object({
      conversationId: z.string().optional(),
      orderId: z.string().optional(),
      address: z.string().optional(),
      notes: z.string().optional(),
      items: z
        .array(
          z.object({
            id: z.string().optional(),
            name: z.string(),
            quantity: z.number().optional(),
            notes: z.string().optional(),
          })
        )
        .default([]),
    }),
    normalize: sanitizePedidosInput,
    run: runPedidos,
    format: (output) => formatPedidosResponse(output),
    fallback:
      "Recibi el pedido pero necesito confirmar items, cantidades y direccion.",
  },
  {
    task: "precios",
    toolName: "precios_agent",
    description: "Agent Tool: calcula ajustes de precios para productos.",
    schema: z.object({
      conversationId: z.string().optional(),
      context: z
        .object({
          costs: z.string().optional(),
          demand: z.string().optional(),
          competition: z.string().optional(),
          notes: z.string().optional(),
        })
        .optional(),
      products: z
        .array(
          z.object({
            productId: z.string().optional(),
            name: z.string(),
            currentPrice: z.number(),
            currency: z.string().optional(),
            cost: z.number().optional(),
            demandSignal: z.string().optional(),
            competitionPrice: z.number().optional(),
            notes: z.string().optional(),
          })
        )
        .default([]),
    }),
    normalize: sanitizePreciosInput,
    run: runPrecios,
    format: (output) => formatPreciosResponse(output),
    fallback:
      "Necesito al menos un producto con precio actual para sugerir ajustes.",
  },
];

const buildSubAgentTools = (
  onUse: (task: TaskName) => void,
  conversationId: string
) =>
  agentToolNodes.map(
    (node) =>
      new DynamicStructuredTool({
        name: node.toolName,
        description: node.description,
        schema: node.schema,
        func: async (rawInput) => {
          onUse(node.task);
          const payload = node.normalize(rawInput, conversationId);
          const result = await (node.run as (input: unknown) => Promise<unknown>)(
            payload
          );
          return node.format(result) ?? node.fallback;
        },
      })
  );

export async function orchestrateWithSubAgents(
  conversationId: string,
  message: string
): Promise<{
  content: string;
  usedAgents: TaskName[];
  messages: BaseMessage[];
}> {
  const usedAgents: TaskName[] = [];
  const tools = buildSubAgentTools((task) => usedAgents.push(task), conversationId);

  const agent = createReactAgent({
    llm: routerModel,
    tools,
    checkpointer: routerCheckpointer,
  });

  const shouldIncludeSystem = !routerThreads.has(conversationId);
  const baseMessages: BaseMessage[] = [];
  if (shouldIncludeSystem) {
    baseMessages.push(new SystemMessage(supervisorPrompt));
  }
  const contextSnippets = retrieveContext(message);
  const contextText = contextSnippets.length
    ? [
        "Contexto util (base interna):",
        ...contextSnippets.map((doc) => `- ${doc.title}: ${doc.text}`),
      ].join("\n")
    : "Contexto util (base interna): sin datos relevantes.";
  baseMessages.push(
    new HumanMessage(
      [
        `conversation_id: ${conversationId}`,
        "Flujo: este nodo Agent decide y llama a un unico Agent Tool segun el pedido.",
        "Devolveme solo la respuesta final, en texto llano.",
        contextText,
        "Mensaje del cliente:",
        message,
      ].join("\n")
    )
  );

  const state = await agent.invoke(
    {
      messages: baseMessages,
    },
    { configurable: { thread_id: conversationId } }
  );
  routerThreads.add(conversationId);

  const finalMessage = state.messages[state.messages.length - 1];
  const content =
    extractText(finalMessage) ||
    "No pude generar una respuesta en este momento, probemos de nuevo en un instante.";

  return { content, usedAgents, messages: state.messages };
}
