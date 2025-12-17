import "server-only";

import { ChatPromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { pedidosSystemPrompt } from "./prompt";
import {
  PedidosTaskInput,
  PedidosTaskOutput,
  PedidoItem,
} from "@/app/lib/ai/orchestrator/types";

const model = new ChatGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_API_KEY ?? "your-google-api-key",
  model: "gemini-2.5-flash",
  temperature: 0.2,
});

const prompt = ChatPromptTemplate.fromMessages([
  ["system", pedidosSystemPrompt],
  [
    "human",
    [
      "Datos del pedido:",
      "ID: {orderId}",
      "Direccion: {address}",
      "Notas: {notes}",
      "Items (JSON):",
      "{items}",
      "",
      "Recordatorio: responde solo el JSON solicitado.",
    ].join("\n"),
  ],
]);

const outputParser = new StringOutputParser();
const chain = prompt.pipe(model).pipe(outputParser);

const cleanJsonResponse = (raw: string): string => {
  const trimmed = raw.trim();
  if (trimmed.startsWith("```")) {
    return trimmed.replace(/^```json\s*/i, "").replace(/```$/, "").trim();
  }
  return trimmed;
};

type IssueEntry = { field?: unknown; message?: unknown; detail?: unknown };

const normalizeIssues = (issues: unknown): string[] => {
  if (!issues) return [];
  if (typeof issues === "string") return [issues];

  if (Array.isArray(issues)) {
    return issues
      .map((entry) => {
        if (typeof entry === "string") return entry;
        if (entry && typeof entry === "object") {
          const typed = entry as IssueEntry;
          const field = typed.field;
          const message = typed.message ?? typed.detail;
          const combined =
            field && message ? `${field}: ${message}` : message ?? field;
          return combined ? String(combined) : null;
        }
        return null;
      })
      .filter((v): v is string => !!v && v.trim().length > 0);
  }

  return [];
};

const coerceItems = (
  responseItems: unknown,
  original: PedidoItem[]
): PedidoItem[] => {
  if (!Array.isArray(responseItems)) return original;

  const originalByName = new Map(
    original.map((item) => [item.name.trim().toLowerCase(), item])
  );

  const normalized: PedidoItem[] = [];

  for (const entry of responseItems) {
    if (!entry || typeof entry !== "object") continue;
    const candidate = entry as {
      id?: unknown;
      name?: unknown;
      quantity?: unknown;
      notes?: unknown;
    };

    const name = String(candidate.name ?? "").trim();
    if (!name) continue;

    const base = originalByName.get(name.toLowerCase());
    const quantityCandidate = candidate.quantity;
    const quantity =
      typeof quantityCandidate === "number" && quantityCandidate > 0
        ? Math.round(quantityCandidate)
        : base?.quantity ?? 1;

    const notesCandidate = candidate.notes ?? base?.notes;
    const idCandidate = candidate.id ?? base?.id;

    normalized.push({
      id: idCandidate ? String(idCandidate) : undefined,
      name,
      quantity,
      notes:
        typeof notesCandidate === "string" && notesCandidate.trim().length > 0
          ? notesCandidate
          : undefined,
    });
  }

  return normalized.length > 0 ? normalized : original;
};

const coerceStatus = (value: unknown): PedidosTaskOutput["status"] => {
  if (value === "received") return "received";
  return "needs_clarification";
};

const formatInput = (input: PedidosTaskInput) => ({
  orderId: input.orderId ?? "no provisto",
  address: input.address ?? "no provista",
  notes: input.notes ?? "sin notas",
  items: JSON.stringify(input.items, null, 2),
});

export async function runPedidos(
  input: PedidosTaskInput
): Promise<PedidosTaskOutput> {
  try {
    const formatted = formatInput(input);
    const raw = await chain.invoke(formatted);
    const cleaned = cleanJsonResponse(raw);

    let parsed: unknown;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      return {
        status: "needs_clarification",
        items: input.items,
        etaMinutes: undefined,
        issues: [
          "No pude interpretar la respuesta del agente de pedidos, podes confirmar los datos?",
        ],
        confirmationMessage:
          "Recibimos tu pedido, pero necesitamos aclarar algunos detalles.",
      };
    }

    const parsedObj =
      parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};

    const status = coerceStatus(parsedObj.status);
    const items = coerceItems(parsedObj.items, input.items);
    const issues = normalizeIssues(parsedObj.issues);

    const eta =
      typeof parsedObj?.etaMinutes === "number" && parsedObj.etaMinutes >= 0
        ? Math.round(parsedObj.etaMinutes)
        : undefined;

    const confirmationMessage =
      typeof parsedObj.confirmationMessage === "string" &&
      parsedObj.confirmationMessage.trim().length > 0
        ? parsedObj.confirmationMessage.trim()
        : status === "received"
        ? "Pedido recibido. Lo preparamos y te avisamos cualquier novedad."
        : undefined;

    const finalIssues =
      status === "needs_clarification" && issues.length === 0
        ? ["Necesito que aclares alguno de los datos del pedido."]
        : issues;

    return {
      status,
      items,
      etaMinutes: status === "received" ? eta : undefined,
      issues: finalIssues,
      confirmationMessage,
    };
  } catch (err) {
    return {
      status: "needs_clarification",
      items: input.items,
      etaMinutes: undefined,
      issues: [
        `Error al procesar el pedido: ${
          err instanceof Error ? err.message : "desconocido"
        }`,
      ],
      confirmationMessage:
        "Recibimos tu pedido, pero hubo un problema. Nos ayudas a confirmarlo?",
    };
  }
}
