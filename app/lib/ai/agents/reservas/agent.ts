import "server-only";

import { BaseMessage, HumanMessage, SystemMessage } from "@langchain/core/messages";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { MemorySaver } from "@langchain/langgraph";
import cancelReservation from "@/app/lib/ai/tools/cancelReservation";
import checkAvailability from "@/app/lib/ai/tools/checkAvailability";
import listReservations from "@/app/lib/ai/tools/listReservations";
import makeReservation from "@/app/lib/ai/tools/makeReservation";
import { reservasPrompt } from "./prompt";
import {
  ReservasTaskInput,
  ReservasTaskOutput,
} from "@/app/lib/ai/orchestrator/types";
import { formatReservasResponse } from "@/app/lib/ai/orchestrator/format";

const reservasTools = [
  checkAvailability,
  makeReservation,
  listReservations,
  cancelReservation,
];

const model = new ChatGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_API_KEY ?? "your-google-api-key",
  model: "gemini-2.5-flash",
  temperature: 0.3,
});

// Memoria compartida para hilos de reservas
const reservasCheckpointer = new MemorySaver();
const reservasThreads = new Set<string>();

const agent = createReactAgent({
  llm: model,
  tools: reservasTools,
  checkpointer: reservasCheckpointer,
});

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

const coerceStatus = (
  value: unknown
): ReservasTaskOutput["status"] | undefined => {
  if (value === "confirmed" || value === "alternative" || value === "unavailable") {
    return value;
  }
  return undefined;
};

const splitMetadata = (
  fullText: string
): { reply: string; meta: Partial<ReservasTaskOutput> } => {
  const match = fullText.match(/METADATA:\s*(\{.*\})/i);
  if (!match) return { reply: fullText.trim(), meta: {} };

  let meta: Partial<ReservasTaskOutput> = {};
  try {
    const parsed = JSON.parse(match[1]);
    const status = coerceStatus(parsed.status);
    meta = {
      status,
      slot: parsed.slot,
      name: parsed.name,
      partySize: parsed.partySize,
      notes: parsed.notes,
    };
  } catch {
    meta = {};
  }

  const reply = fullText.replace(match[0], "").trim();
  return { reply, meta };
};

const buildMessages = (input: ReservasTaskInput): BaseMessage[] => {
  const humanContent = [
    `ID de conversacion: ${input.conversationId}`,
    "Usa el conversationId como nombre/identificador de la reserva si el cliente no da otro.",
    "Busca reservas por nombre de la reserva, no por userId.",
    "Mensaje del cliente:",
    input.message,
    "",
    "Usa las herramientas si sirven y hablale al cliente sin mostrar JSON.",
  ].join("\n");

  const messages: BaseMessage[] = [];
  if (!reservasThreads.has(input.conversationId)) {
    messages.push(new SystemMessage(reservasPrompt));
  }
  messages.push(new HumanMessage(humanContent));
  return messages;
};

export async function runReservas(
  input: ReservasTaskInput
): Promise<ReservasTaskOutput> {
  try {
    const { messages } = await agent.invoke(
      {
        messages: buildMessages(input),
      },
      { configurable: { thread_id: input.conversationId } }
    );
    reservasThreads.add(input.conversationId);

    const finalMessage = messages[messages.length - 1];
    const rawText = extractText(finalMessage);
  const { reply, meta } = splitMetadata(rawText);

    const cleanedReply = looksLikeJson(reply) ? "" : reply;
    const summary = formatReservasResponse({
      status: meta.status,
      slot: meta.slot,
      name: meta.name,
      partySize: meta.partySize,
      notes: meta.notes,
      rawReply: undefined,
    });

    return {
      status: meta.status ?? "alternative",
      slot: meta.slot,
      name: meta.name,
      partySize: meta.partySize,
      notes: meta.notes,
      rawReply:
        cleanedReply ||
        summary ||
        "No pude confirmar nada todavia, necesito fecha, horario y cuantas personas son.",
    };
  } catch (err) {
    return {
      status: "unavailable",
      rawReply: `Hubo un problema gestionando la reserva: ${
        err instanceof Error ? err.message : "desconocido"
      }`,
    };
  }
}
