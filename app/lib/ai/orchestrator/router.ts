import "server-only";

import { ChatPromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import z from "zod";
import { OrchestratorInput } from "./types";

const routerModel = new ChatGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_API_KEY ?? "your-google-api-key",
  // Usamos Gemini 3 (preview) pero sin tools, para evitar requisitos de thought_signature.
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

const prompt = ChatPromptTemplate.fromMessages([
  [
    "system",
    [
      "Sos un despachador para un sistema multi-agente (reservas | pedidos | precios).",
      "Elegí exactamente UN agente y completá su payload JSON; dejá los otros en null.",
      "Formato estrictamente JSON y valido: {{ \"reservas\": {{...}} | null, \"pedidos\": {{...}} | null, \"precios\": {{...}} | null }}.",
      "Si faltan datos, dejalos vacíos pero con tipos correctos; no inventes items ni productos.",
    ].join("\n"),
  ],
  [
    "human",
    [
      "ID conversacion: {conversationId}",
      "Mensaje del cliente:",
      "{message}",
    ].join("\n"),
  ],
]);

const chain = prompt.pipe(routerModel).pipe(new StringOutputParser());

const cleanJson = (raw: string): string => {
  const trimmed = raw.trim();
  if (trimmed.startsWith("```")) {
    return trimmed.replace(/^```json\s*/i, "").replace(/```$/, "").trim();
  }
  return trimmed;
};

export async function routeToTasks(
  conversationId: string,
  message: string
): Promise<OrchestratorInput> {
  try {
    const raw = await chain.invoke({ conversationId, message });
    const cleaned = cleanJson(raw);
    const parsed = JSON.parse(cleaned);
    const validated = orchestratorSchema.safeParse(parsed);

    if (validated.success) {
      const data = validated.data;
      return {
        reservas: data.reservas ?? undefined,
        pedidos: data.pedidos ?? undefined,
        precios: data.precios ?? undefined,
      };
    }
  } catch (err) {
    console.error("[router] parse error", err);
  }

  // Fallback mínimo: responder con reservas para no quedar en blanco.
  return { reservas: { conversationId, message } };
}
