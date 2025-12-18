import "server-only";

import { BaseMessage, HumanMessage, SystemMessage } from "@langchain/core/messages";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { MemorySaver } from "@langchain/langgraph";
import { pedidosSystemPrompt } from "./prompt";
import {
  PedidosTaskInput,
  PedidosTaskOutput,
  PedidoItem,
} from "@/app/lib/ai/orchestrator/types";
import { productRepository } from "@/app/lib/db/repositories/productRepository";
import { pedidoRepository } from "@/app/lib/db/repositories/pedidoRepository";

const model = new ChatGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_API_KEY ?? "your-google-api-key",
  model: "gemini-2.5-flash",
  temperature: 0.2,
});

const pedidosCheckpointer = new MemorySaver();
const pedidosAgent = createReactAgent({
  llm: model,
  tools: [],
  checkpointer: pedidosCheckpointer,
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

type CatalogProduct = Awaited<ReturnType<typeof productRepository.list>>[number];

const slugifyId = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const findProductMatch = (name: string, catalog: CatalogProduct[]) => {
  const normalized = name.trim().toLowerCase();
  return (
    catalog.find(
      (p) =>
        p.id.toLowerCase() === normalized ||
        p.name.toLowerCase() === normalized ||
        p.name.toLowerCase().includes(normalized)
    ) ?? null
  );
};

const coerceItems = (
  responseItems: unknown,
  original: PedidoItem[],
  catalog: CatalogProduct[]
): PedidoItem[] => {
  const baseItems = Array.isArray(responseItems) ? responseItems : original;

  const normalized: PedidoItem[] = [];

  for (const entry of baseItems) {
    if (!entry || typeof entry !== "object") continue;
    const candidate = entry as {
      id?: unknown;
      name?: unknown;
      quantity?: unknown;
      notes?: unknown;
    };

    const name = String(candidate.name ?? "").trim();
    if (!name) continue;

    const base = original.find(
      (item) => item.name.trim().toLowerCase() === name.toLowerCase()
    );
    const catalogMatch = findProductMatch(name, catalog);

    const quantityCandidate = candidate.quantity;
    const quantity =
      typeof quantityCandidate === "number" && quantityCandidate > 0
        ? Math.round(quantityCandidate)
        : base?.quantity ?? 1;

    const notesCandidate = candidate.notes ?? base?.notes;
    const idCandidate = candidate.id ?? catalogMatch?.id ?? base?.id;

    normalized.push({
      id: idCandidate ? String(idCandidate) : slugifyId(name),
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

const persistOrder = async (params: {
  input: PedidosTaskInput;
  items: PedidoItem[];
  eta?: number;
  status: PedidosTaskOutput["status"];
  catalog: CatalogProduct[];
}) => {
  if (params.status !== "received") return null;

  const itemsForOrder = params.items.map((item) => {
    const match = findProductMatch(item.name, params.catalog);
    return {
      productId: match?.id ?? item.id ?? slugifyId(item.name),
      name: match?.name ?? item.name,
      quantity: item.quantity,
      notes: item.notes,
    };
  });

  if (params.input.orderId) {
    const existing = await pedidoRepository.getById(params.input.orderId);
    if (existing) {
      await pedidoRepository.updateStatus(
        params.input.orderId,
        "received",
        params.eta
      );
      return params.input.orderId;
    }
  }

  const created = await pedidoRepository.create({
    address: params.input.address ?? "Retiro en local",
    items: itemsForOrder,
    notes: params.input.notes,
    etaMinutes: params.eta,
  });

  return created.id;
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
    const catalog = await productRepository.list();
    const formatted = formatInput(input);
    const { messages } = await pedidosAgent.invoke(
      {
        messages: [
          new SystemMessage(pedidosSystemPrompt),
          new HumanMessage(
            [
              "Datos del pedido:",
              `ID: ${formatted.orderId}`,
              `Direccion: ${formatted.address}`,
              `Notas: ${formatted.notes}`,
              "Items (JSON):",
              formatted.items,
              "",
              "Recordatorio: responde solo el JSON solicitado.",
            ].join("\n")
          ),
        ],
      },
      {
        configurable: {
          thread_id: input.conversationId ?? input.orderId ?? "pedidos",
        },
      }
    );
    const raw = extractText(messages[messages.length - 1]);
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
    const items = coerceItems(parsedObj.items, input.items, catalog);
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

    const savedOrderId = await persistOrder({
      input,
      items,
      eta,
      status,
      catalog,
    });

    const idSuffix = savedOrderId ? ` (pedido #${savedOrderId})` : "";

    return {
      status,
      items,
      etaMinutes: status === "received" ? eta : undefined,
      issues: finalIssues,
      confirmationMessage:
        confirmationMessage ??
        (status === "received"
          ? `Listo, tome tu pedido${idSuffix}. Te aviso apenas salga.`
          : undefined),
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
