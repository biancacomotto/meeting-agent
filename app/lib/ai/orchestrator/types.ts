export type TaskName = "reservas" | "pedidos" | "precios" | "carta";

export type ReservasTaskInput = {
  conversationId: string;
  message: string;
};

export type ReservasTaskOutput = {
  status?: "confirmed" | "alternative" | "unavailable";
  slot?: string;
  name?: string;
  partySize?: number;
  notes?: string;
  rawReply?: string;
};

export type PedidoItem = {
  id?: string;
  name: string;
  quantity: number;
  notes?: string;
};

export type PedidosTaskInput = {
  conversationId?: string;
  orderId?: string;
  items: PedidoItem[];
  address?: string;
  notes?: string;
};

export type PedidosTaskOutput = {
  status: "received" | "needs_clarification";
  items: PedidoItem[];
  etaMinutes?: number;
  issues: string[];
  confirmationMessage?: string;
};

export type PrecioProducto = {
  productId: string;
  name: string;
  currentPrice: number;
  currency?: string;
  cost?: number;
  demandSignal?: string;
  competitionPrice?: number;
  notes?: string;
};

export type PreciosContext = {
  costs?: string;
  demand?: string;
  competition?: string;
  notes?: string;
  confirm?: boolean; // si true, aplicar cambios; si undefined/false, solo sugerir
};

export type PreciosTaskInput = {
  conversationId?: string;
  products: PrecioProducto[];
  context?: PreciosContext;
};

export type PreciosTaskOutputItem = {
  productId: string;
  name: string;
  currentPrice: number;
  newPrice: number;
  rationale: string;
  suggestedFrom?: string;
  suggestedUntil?: string;
};

export type PreciosTaskOutput = PreciosTaskOutputItem[];

export type CartaTaskInput = {
  conversationId?: string;
};

export type CartaTaskOutput = {
  link: string;
  count: number;
};

export type OrchestratorInput = {
  reservas?: ReservasTaskInput;
  pedidos?: PedidosTaskInput;
  precios?: PreciosTaskInput;
  carta?: CartaTaskInput;
};

export type TaskStatus = "ok" | "error" | "timeout" | "skipped";

export type TaskResult<TOutput> = {
  task: TaskName;
  status: TaskStatus;
  durationMs: number;
  output?: TOutput;
  error?: string;
};

export type OrchestratorResult = {
  reservas: TaskResult<ReservasTaskOutput>;
  pedidos: TaskResult<PedidosTaskOutput>;
  precios: TaskResult<PreciosTaskOutput>;
  carta: TaskResult<CartaTaskOutput>;
};

export type AgentTask<TInput, TOutput> = (input: TInput) => Promise<TOutput>;

export type RunAllTasksOptions = {
  timeouts?: Partial<Record<TaskName, number>>;
};
