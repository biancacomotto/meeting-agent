import "server-only";

import { productRepository } from "@/app/lib/db/repositories/productRepository";
import {
  CartaTaskInput,
  CartaTaskOutput,
} from "@/app/lib/ai/orchestrator/types";

const normalizeBaseUrl = (raw?: string | null) => {
  if (!raw) return null;
  if (raw.startsWith("http://") || raw.startsWith("https://")) return raw;
  return `https://${raw}`;
};

const resolveMenuLink = () => {
  const baseUrl = normalizeBaseUrl(
    process.env.NEXT_PUBLIC_APP_URL ??
      process.env.NEXT_PUBLIC_BASE_URL ??
      process.env.VERCEL_URL ??
      null
  );
  return baseUrl ? `${baseUrl}/menu` : "/menu";
};

export async function runCarta(
  _input: CartaTaskInput
): Promise<CartaTaskOutput> {
  const products = await productRepository.list();
  return {
    link: resolveMenuLink(),
    count: products.length,
  };
}
