import "server-only";
import { BaseMessage, HumanMessage, SystemMessage } from "@langchain/core/messages";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { MemorySaver } from "@langchain/langgraph";
import { priceAgentSystemPrompt } from "./prompt";
import {
  PreciosTaskInput,
  PreciosTaskOutput,
  PreciosTaskOutputItem,
} from "@/app/lib/ai/orchestrator/types";
import { productRepository } from "@/app/lib/db/repositories/productRepository";

type CatalogProduct = Awaited<ReturnType<typeof productRepository.list>>[number];

const findProductMatch = (nameOrId: string, catalog: CatalogProduct[]) => {
  const needle = nameOrId.trim().toLowerCase();
  return (
    catalog.find(
      (p) =>
        p.id.toLowerCase() === needle ||
        p.name.toLowerCase() === needle ||
        p.name.toLowerCase().includes(needle) ||
        needle.includes(p.name.toLowerCase())
    ) ?? null
  );
};

const enrichProducts = (
  products: PreciosTaskInput["products"],
  catalog: CatalogProduct[]
) => {
  return products.map((p) => {
    const match =
      findProductMatch(p.productId ?? "", catalog) ??
      findProductMatch(p.name, catalog);
    return {
      productId: p.productId ?? match?.id ?? p.name,
      name: p.name ?? match?.name ?? "Sin nombre",
      currentPrice: match?.price ?? p.currentPrice ?? 0, // fuerza precio de catalogo si existe
      currency: match?.currency ?? p.currency,
      cost: p.cost ?? match?.cost,
      demandSignal: p.demandSignal ?? match?.demandSignal,
      competitionPrice: p.competitionPrice ?? match?.competitionPrice,
      notes: p.notes ?? match?.notes,
    };
  });
};

const formatCatalogForPrompt = (catalog: CatalogProduct[]) =>
  catalog
    .map(
      (p) =>
        `- ${p.name} (${p.id}): ${p.price} ${p.currency ?? "ARS"}`
    )
    .join("\n");

const model = new ChatGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_API_KEY ?? "your-google-api-key",
  model: "gemini-2.5-flash",
  temperature: 0.2,
});

const preciosCheckpointer = new MemorySaver();
const preciosAgent = createReactAgent({
  llm: model,
  tools: [],
  checkpointer: preciosCheckpointer,
});
const preciosThreads = new Set<string>();

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

function cleanJsonResponse(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith("```")) {
    return trimmed.replace(/^```json\s*/i, "").replace(/```$/, "").trim();
  }
  return trimmed;
}

type RawProposal = {
  productId?: unknown;
  id?: unknown;
  name?: unknown;
  currentPrice?: unknown;
  newPrice?: unknown;
  price?: unknown;
  rationale?: unknown;
  reason?: unknown;
  suggestedFrom?: unknown;
  validFrom?: unknown;
  suggestedUntil?: unknown;
  validUntil?: unknown;
};

function normalizeProposal(entry: RawProposal): PreciosTaskOutputItem {
  const proposal: PreciosTaskOutputItem = {
    productId: String(entry?.productId ?? entry?.id ?? ""),
    name: String(entry?.name ?? ""),
    currentPrice: Number(entry?.currentPrice ?? 0),
    newPrice: Number(entry?.newPrice ?? entry?.price ?? entry?.currentPrice ?? 0),
    rationale: String(entry?.rationale ?? entry?.reason ?? ""),
  };

  if (entry?.suggestedFrom) {
    proposal.suggestedFrom = String(entry.suggestedFrom);
  } else if (entry?.validFrom) {
    proposal.suggestedFrom = String(entry.validFrom);
  }

  if (entry?.suggestedUntil) {
    proposal.suggestedUntil = String(entry.suggestedUntil);
  } else if (entry?.validUntil) {
    proposal.suggestedUntil = String(entry.validUntil);
  }

  if (!proposal.productId || !proposal.name) {
    throw new Error("El agente devolvio una propuesta sin productId o name");
  }

  return proposal;
}

function coerceProposals(parsed: unknown): PreciosTaskOutput {
  if (Array.isArray(parsed)) {
    return parsed.map((p) => normalizeProposal(p as RawProposal));
  }

  if (
    parsed &&
    typeof parsed === "object" &&
    "proposals" in parsed &&
    Array.isArray((parsed as { proposals?: unknown }).proposals)
  ) {
    return (
      parsed as { proposals: RawProposal[] }
    ).proposals.map((p: RawProposal) => normalizeProposal(p));
  }

  throw new Error("La respuesta del agente no trae un array de propuestas");
}

const formatInput = (params: {
  products: PreciosTaskInput["products"];
  context?: PreciosTaskInput["context"];
}): {
  context: string;
  products: string;
  currency: string;
} => {
  const context =
    params.context && Object.keys(params.context).length > 0
      ? JSON.stringify(params.context, null, 2)
      : "Sin contexto adicional";

  const products = JSON.stringify(params.products, null, 2);

  const preferredCurrency =
    params.products.find((p) => p.currency)?.currency ?? "ARS";

  return { context, products, currency: preferredCurrency };
};

async function withCatalogFallback(
  input: PreciosTaskInput,
  catalog: CatalogProduct[]
): Promise<PreciosTaskInput> {
  if (input.products && input.products.length > 0) return input;

  return {
    ...input,
    products: catalog.map((p) => ({
      productId: p.id,
      name: p.name,
      currentPrice: p.price,
      currency: p.currency,
      cost: p.cost,
      demandSignal: p.demandSignal,
      competitionPrice: p.competitionPrice,
      notes: p.notes,
    })),
  };
}

export async function runPrecios(
  input: PreciosTaskInput
): Promise<PreciosTaskOutput> {
  const catalog = await productRepository.list();
  const resolvedInput = await withCatalogFallback(input, catalog);
  if (!resolvedInput.products || resolvedInput.products.length === 0) {
    throw new Error("Debes enviar al menos un producto para ajustar precios");
  }

  const enrichedProducts = enrichProducts(resolvedInput.products, catalog);
  const formatted = formatInput({
    products: enrichedProducts,
    context: resolvedInput.context,
  });
  const catalogSummary = formatCatalogForPrompt(catalog);
  const shouldApply = resolvedInput.context?.confirm === true;
  const threadId = input.conversationId ?? "precios";
  const { messages } = await preciosAgent.invoke(
    {
      messages: [
        ...(preciosThreads.has(threadId)
          ? []
          : [new SystemMessage(priceAgentSystemPrompt)]),
        new HumanMessage(
          [
            `Moneda preferida: ${formatted.currency}`,
            "Contexto de negocio:",
            formatted.context,
            "Productos a ajustar (JSON):",
            formatted.products,
            "",
            "Catalogo conocido con precios vigentes:",
            catalogSummary,
          ].join("\n")
        ),
      ],
    },
    {
      configurable: {
        thread_id: threadId,
      },
    }
  );
  preciosThreads.add(threadId);
  const raw = extractText(messages[messages.length - 1]);
  const cleaned = cleanJsonResponse(raw);

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error(
      `No se pudo interpretar la respuesta del agente de precios: ${cleaned}`
    );
  }

  const proposals = coerceProposals(parsed);

  if (shouldApply) {
    await Promise.all(
      proposals.map(async (proposal) => {
        const updated = await productRepository.upsertPrice(
          proposal.productId,
          proposal.newPrice
        );
        if (!updated) {
          const byName = await productRepository.findByName(proposal.name);
          if (byName) {
            await productRepository.upsertPrice(byName.id, proposal.newPrice);
          }
        }
      })
    );
  }

  return proposals;
}
