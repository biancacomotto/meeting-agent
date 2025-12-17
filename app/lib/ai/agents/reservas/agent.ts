import "server-only";

import {
  AIMessage,
  BaseMessage,
  HumanMessage,
  SystemMessage,
  ToolMessage,
} from "@langchain/core/messages";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import cancelReservation from "@/app/lib/ai/tools/cancelReservation";
import checkAvailability from "@/app/lib/ai/tools/checkAvailability";
import listReservations from "@/app/lib/ai/tools/listReservations";
import makeReservation from "@/app/lib/ai/tools/makeReservation";
import { reservasPrompt } from "./prompt";
import {
  ReservasTaskInput,
  ReservasTaskOutput,
} from "@/app/lib/ai/orchestrator/types";

const reservasTools = [
  checkAvailability,
  makeReservation,
  listReservations,
  cancelReservation,
];

const toolsByName = Object.fromEntries(
  reservasTools.map((tool) => [tool.name, tool])
);

const model = new ChatGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_API_KEY ?? "your-google-api-key",
  model: "gemini-2.5-flash",
  temperature: 0.3,
}).bindTools(reservasTools);

const extractText = (message: BaseMessage): string => {
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

const cleanJsonResponse = (raw: string): string => {
  const trimmed = raw.trim();
  if (trimmed.startsWith("```")) {
    return trimmed.replace(/^```json\s*/i, "").replace(/```$/, "").trim();
  }
  return trimmed;
};

const tryParseJson = (raw: string): unknown | null => {
  try {
    return JSON.parse(cleanJsonResponse(raw));
  } catch {
    return null;
  }
};

const coerceStatus = (
  value: unknown
): ReservasTaskOutput["status"] | undefined => {
  if (value === "confirmed" || value === "alternative" || value === "unavailable")
    return value;
  return undefined;
};

const normalizeOutput = (
  parsed: unknown,
  rawReply: string
): ReservasTaskOutput => {
  const output: ReservasTaskOutput = {
    rawReply,
  };

  if (!parsed || typeof parsed !== "object") {
    return output;
  }

  const candidate = parsed as Record<string, unknown>;

  const status = coerceStatus(candidate.status);
  if (status) output.status = status;

  if (candidate.slot || candidate.time || candidate.datetime) {
    output.slot = String(candidate.slot ?? candidate.time ?? candidate.datetime);
  }

  if (candidate.name || candidate.customerName || candidate.guestName) {
    output.name = String(
      candidate.name ?? candidate.customerName ?? candidate.guestName
    );
  }

  const sizeCandidate =
    candidate.partySize ??
    candidate.people ??
    candidate.guests ??
    candidate.quantity;
  if (typeof sizeCandidate === "number" && sizeCandidate > 0) {
    output.partySize = Math.round(sizeCandidate);
  }

  if (candidate.notes || candidate.reason || candidate.message) {
    output.notes = String(candidate.notes ?? candidate.reason ?? candidate.message);
  }

  if (!output.status && rawReply.toLowerCase().includes("no hay")) {
    output.status = "unavailable";
  }

  return output;
};

const buildMessages = (input: ReservasTaskInput): BaseMessage[] => {
  const humanContent = [
    `ID de conversacion: ${input.conversationId}`,
    "Mensaje del cliente:",
    input.message,
    "",
    'Devuelve siempre un JSON final con este esquema: {"status":"confirmed|alternative|unavailable","slot":string?,"name":string?,"partySize":number?,"notes":string?}.',
  ].join("\n");

  return [new SystemMessage(reservasPrompt), new HumanMessage(humanContent)];
};

const runWithTools = async (
  input: ReservasTaskInput
): Promise<AIMessage> => {
  const messages: BaseMessage[] = buildMessages(input);
  let lastAI: AIMessage | null = null;

  for (let step = 0; step < 4; step++) {
    const aiMessage = await model.invoke(messages);
    lastAI = aiMessage;
    messages.push(aiMessage);

    const toolCalls =
      (aiMessage as AIMessage & {
        tool_calls?: Array<{
          id: string;
          name: string;
          args?: unknown;
          input?: unknown;
        }>;
      }).tool_calls ?? [];
    if (!toolCalls.length) break;

    for (const call of toolCalls) {
      const tool = toolsByName[call.name];
      const toolArgs =
        (call.args as Record<string, unknown> | undefined) ??
        (call.input as Record<string, unknown> | undefined) ??
        {};

      if (!tool) {
        messages.push(
          new ToolMessage({
            tool_call_id: call.id,
            content: `Herramienta ${call.name} no disponible`,
          })
        );
        continue;
      }

      try {
        const toolResult = await tool.invoke(toolArgs);
        messages.push(
          new ToolMessage({
            tool_call_id: call.id,
            content: typeof toolResult === "string" ? toolResult : JSON.stringify(toolResult),
          })
        );
      } catch (err) {
        messages.push(
          new ToolMessage({
            tool_call_id: call.id,
            content: `Error al ejecutar ${call.name}: ${
              err instanceof Error ? err.message : "desconocido"
            }`,
          })
        );
      }
    }
  }

  if (!lastAI) {
    throw new Error("No se obtuvo respuesta del agente de reservas");
  }

  return lastAI;
};

export async function runReservas(
  input: ReservasTaskInput
): Promise<ReservasTaskOutput> {
  try {
    const aiMessage = await runWithTools(input);
    const rawReply = extractText(aiMessage);
    const parsed = tryParseJson(rawReply);

    if (parsed) {
      return normalizeOutput(parsed, rawReply);
    }

    return {
      status: "unavailable",
      rawReply: rawReply || "No se pudo interpretar la respuesta del agente.",
    };
  } catch (err) {
    return {
      status: "unavailable",
      rawReply: `Error al gestionar reserva: ${
        err instanceof Error ? err.message : "desconocido"
      }`,
    };
  }
}
