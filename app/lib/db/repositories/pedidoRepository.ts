import { nextOrderId, orders, Order, OrderItem } from "../memory/commerceStore";

export const pedidoRepository = {
  async list() {
    return Array.from(orders.values());
  },

  async getById(id: string) {
    return orders.get(id) ?? null;
  },

  async create(data: {
    address: string;
    items: OrderItem[];
    notes?: string;
    etaMinutes?: number;
  }) {
    const id = nextOrderId();
    const order: Order = {
      id,
      address: data.address,
      items: data.items,
      notes: data.notes,
      status: "received",
      etaMinutes: data.etaMinutes,
      createdAt: new Date(),
    };
    orders.set(id, order);
    return order;
  },

  async updateStatus(id: string, status: Order["status"], etaMinutes?: number) {
    const existing = orders.get(id);
    if (!existing) return null;
    const updated = { ...existing, status, etaMinutes };
    orders.set(id, updated);
    return updated;
  },
};
