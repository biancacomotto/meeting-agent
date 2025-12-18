import "server-only";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { priceAgentSystemPrompt } from "./prompt";
import {
  PreciosTaskInput,
  PreciosTaskOutput,
  PreciosTaskOutputItem,
} from "@/app/lib/ai/orchestrator/types";
import { productRepository } from "@/app/lib/db/repositories/productRepository";

const model = new ChatGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_API_KEY ?? "your-google-api-key",
  model: "gemini-2.5-flash",
  temperature: 0.2,
});

const prompt = ChatPromptTemplate.fromMessages([
  ["system", priceAgentSystemPrompt],
  [
    "human",
    [
      "Moneda preferida: {currency}",
      "Contexto de negocio:",
      "{context}",
      "Productos a ajustar (JSON):",
      "{products}",
    ].join("\n"),
  ],
]);

const outputParser = new StringOutputParser();
const chain = prompt.pipe(model).pipe(outputParser);

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

function formatInput(input: PreciosTaskInput): {
  context: string;
  products: string;
  currency: string;
} {
  const context =
    input.context && Object.keys(input.context).length > 0
      ? JSON.stringify(input.context, null, 2)
      : "Sin contexto adicional";

  const products = JSON.stringify(input.products, null, 2);

  const preferredCurrency =
    input.products.find((p) => p.currency)?.currency ?? "ARS";

  return { context, products, currency: preferredCurrency };
}

async function withCatalogFallback(
  input: PreciosTaskInput
): Promise<PreciosTaskInput> {
  if (input.products && input.products.length > 0) return input;
  const catalog = await productRepository.list();

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
  const resolvedInput = await withCatalogFallback(input);
  if (!resolvedInput.products || resolvedInput.products.length === 0) {
    throw new Error("Debes enviar al menos un producto para ajustar precios");
  }

  const formatted = formatInput(resolvedInput);
  const raw = await chain.invoke(formatted);
  const cleaned = cleanJsonResponse(raw);

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error(
      `No se pudo interpretar la respuesta del agente de precios: ${cleaned}`
    );
  }

  return coerceProposals(parsed);
}
