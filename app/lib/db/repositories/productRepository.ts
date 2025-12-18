import { Product, products } from "../memory/commerceStore";

export const productRepository = {
  async list() {
    return Array.from(products.values());
  },

  async findById(id: string) {
    return products.get(id) ?? null;
  },

  async findByName(name: string) {
    const normalized = name.trim().toLowerCase();
    return (
      Array.from(products.values()).find(
        (p) =>
          p.name.toLowerCase() === normalized ||
          p.name.toLowerCase().includes(normalized)
      ) ?? null
    );
  },

  async upsertPrice(id: string, price: number) {
    const existing = products.get(id);
    if (!existing) return null;
    const updated: Product = { ...existing, price };
    products.set(id, updated);
    return updated;
  },
};
