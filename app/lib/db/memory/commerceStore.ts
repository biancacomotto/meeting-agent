export type Product = {
  id: string;
  name: string;
  price: number;
  currency: string;
  cost: number;
  demandSignal?: string;
  competitionPrice?: number;
  notes?: string;
};

export type OrderItem = {
  productId: string;
  name: string;
  quantity: number;
  notes?: string;
};

export type Order = {
  id: string;
  address: string;
  items: OrderItem[];
  notes?: string;
  status: "received" | "preparing" | "ready" | "delivered";
  etaMinutes?: number;
  createdAt: Date;
};

export const products = new Map<string, Product>();
export const orders = new Map<string, Order>();

let orderSeq = 1;

export const nextOrderId = () => `ORD-${(orderSeq++).toString().padStart(3, "0")}`;

function seedProducts() {
  const seed: Product[] = [
    {
      id: "mila-napo",
      name: "Milanesa napolitana con fritas",
      price: 7800,
      currency: "ARS",
      cost: 4100,
      demandSignal: "siempre top en almuerzos",
      competitionPrice: 8200,
      notes: "porcion generosa",
    },
    {
      id: "pizza-muzza",
      name: "Pizza muzarella a la piedra",
      price: 6400,
      currency: "ARS",
      cost: 3000,
      demandSignal: "alta rotacion viernes",
      competitionPrice: 7000,
      notes: "8 porciones, masa madre",
    },
    {
      id: "emp-6",
      name: "Box de 6 empanadas",
      price: 5200,
      currency: "ARS",
      cost: 2300,
      demandSignal: "mejor combo delivery",
      competitionPrice: 5500,
    },
    {
      id: "vino-malbec",
      name: "Malbec joven 750ml",
      price: 9500,
      currency: "ARS",
      cost: 5100,
      demandSignal: "venta estable",
      competitionPrice: 9900,
    },
    {
      id: "postre-flan",
      name: "Flan casero con dulce",
      price: 2900,
      currency: "ARS",
      cost: 1200,
      demandSignal: "sube en cenas",
      competitionPrice: 3100,
    },
  ];

  seed.forEach((product) => products.set(product.id, product));
}

function seedOrders() {
  const sample: Order[] = [
    {
      id: nextOrderId(),
      address: "Av. Cabildo 1234, piso 3",
      items: [
        { productId: "pizza-muzza", name: "Pizza muzarella a la piedra", quantity: 1 },
        { productId: "postre-flan", name: "Flan casero con dulce", quantity: 2 },
      ],
      notes: "Sin ajo en la pizza",
      status: "preparing",
      etaMinutes: 20,
      createdAt: new Date(),
    },
    {
      id: nextOrderId(),
      address: "Amenabar 4450, timbre B",
      items: [{ productId: "emp-6", name: "Box de 6 empanadas", quantity: 1 }],
      status: "received",
      createdAt: new Date(),
    },
  ];

  sample.forEach((order) => orders.set(order.id, order));
}

(function seedCommerce() {
  seedProducts();
  seedOrders();
})();
