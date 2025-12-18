import "server-only";

import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { tool } from "@langchain/core/tools";
import { HumanMessage } from "@langchain/core/messages";
import z from "zod";
import {
  OrchestratorInput,
  PedidosTaskInput,
  PreciosTaskInput,
} from "./types";

const reservasTool = tool(
  async ({ conversationId, message }) => ({ conversationId, message }),
  {
    name: "reservas",
    description:
      "Elegilo cuando el cliente habla de reservar una mesa, horarios o cantidad de personas.",
    schema: z.object({
      conversationId: z.string(),
      message: z.string(),
    }),
  }
);

const pedidosTool = tool(
  async ({ orderId, address, notes, items }) =>
    ({
      orderId,
      address,
      notes,
      items,
    }) as PedidosTaskInput,
  {
    name: "pedidos",
    description:
      "Elegilo cuando el cliente esta haciendo o ajustando un pedido de comida/bebida.",
    schema: z.object({
      orderId: z.string().optional(),
      address: z.string().optional(),
      notes: z.string().optional(),
      items: z
        .array(
          z.object({
            id: z.string().optional(),
            name: z.string(),
            quantity: z.number().default(1),
            notes: z.string().optional(),
          })
        )
        .default([]),
    }),
  }
);

const preciosTool = tool(
  async ({ products, context }) =>
    ({
      products,
      context,
    }) as PreciosTaskInput,
  {
    name: "precios",
    description:
      "Elegilo cuando pidan ajustar precios de productos, promociones o analizar demanda/costos.",
    schema: z.object({
      products: z.array(
        z.object({
          productId: z.string(),
          name: z.string(),
          currentPrice: z.number(),
          currency: z.string().optional(),
          cost: z.number().optional(),
          demandSignal: z.string().optional(),
          competitionPrice: z.number().optional(),
          notes: z.string().optional(),
        })
      ),
      context: z
        .object({
          costs: z.string().optional(),
          demand: z.string().optional(),
          competition: z.string().optional(),
          notes: z.string().optional(),
        })
        .optional(),
    }),
  }
);

const routerModel = new ChatGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_API_KEY ?? "your-google-api-key",
  model: "gemini-2.5-flash",
  temperature: 0.2,
});

const orchestratorSchema = z.object({
  reservas: z
    .object({
      conversationId: z.string(),
      message: z.string(),
    })
    .nullable()
    .optional(),
  pedidos: z
    .object({
      orderId: z.string().optional(),
      address: z.string().optional(),
      notes: z.string().optional(),
      items: z
        .array(
          z.object({
            id: z.string().optional(),
            name: z.string(),
            quantity: z.number(),
            notes: z.string().optional(),
          })
        )
        .default([]),
    })
    .nullable()
    .optional(),
  precios: z
    .object({
      products: z.array(
        z.object({
          productId: z.string(),
          name: z.string(),
          currentPrice: z.number(),
          currency: z.string().optional(),
          cost: z.number().optional(),
          demandSignal: z.string().optional(),
          competitionPrice: z.number().optional(),
          notes: z.string().optional(),
        })
      ),
      context: z
        .object({
          costs: z.string().optional(),
          demand: z.string().optional(),
          competition: z.string().optional(),
          notes: z.string().optional(),
        })
        .optional(),
    })
    .nullable()
    .optional(),
});

const routerPrompt = [
  "Sos un despachador para un sistema multi-agente (reservas | pedidos | precios).",
  "Elegí exactamente UN agente y llamá a su herramienta con los datos estructurados.",
  "Si el mensaje no trae datos suficientes, pedí lo mínimo indispensable en el tool call (ej: items vacíos, notes con el texto del usuario).",
  "No escribas texto libre; usá solo llamadas a herramientas y la respuesta final estructurada.",
].join("\n");

const routerAgent = createReactAgent({
  llm: routerModel,
  tools: [reservasTool, pedidosTool, preciosTool],
  prompt: routerPrompt,
  responseFormat: orchestratorSchema,
});

export async function routeToTasks(
  conversationId: string,
  message: string
): Promise<OrchestratorInput> {
  const userMessage = [
    `ID conversacion: ${conversationId}`,
    "Mensaje del cliente:",
    message,
  ].join("\n");

  const result = await routerAgent.invoke({
    messages: [new HumanMessage(userMessage)],
  });

  // Prefer the structuredResponse when available.
  const structured =
    (result as { structuredResponse?: unknown }).structuredResponse ?? null;

  if (structured && typeof structured === "object") {
    const parsed = orchestratorSchema.safeParse(structured);
    if (parsed.success) {
      const data = parsed.data;
      return {
        reservas: data.reservas ?? undefined,
        pedidos: data.pedidos ?? undefined,
        precios: data.precios ?? undefined,
      };
    }
  }

  // Fallback: build a minimal reservas payload so something responds.
  return { reservas: { conversationId, message } };
}
