import { runCarta } from "@/app/lib/ai/agents/carta/agent";
import { runPedidos } from "@/app/lib/ai/agents/pedidos/agent";
import { runPrecios } from "@/app/lib/ai/agents/precios/agent";
import { runReservas } from "@/app/lib/ai/agents/reservas/agent";
import {
  AgentTask,
  CartaTaskOutput,
  OrchestratorInput,
  OrchestratorResult,
  PedidosTaskOutput,
  PreciosTaskOutput,
  ReservasTaskOutput,
  RunAllTasksOptions,
  TaskName,
  TaskResult,
  TaskStatus,
} from "@/app/lib/ai/orchestrator/types";

const DEFAULT_TIMEOUTS: Record<TaskName, number> = {
  reservas: 15_000,
  pedidos: 12_000,
  precios: 12_000,
  carta: 5_000,
};

class TimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TimeoutError";
  }
}

const resolveStatus = (error: unknown): TaskStatus => {
  if (error instanceof TimeoutError) return "timeout";
  return "error";
};

const withTimeout = async <T>(
  fn: () => Promise<T>,
  timeoutMs: number
): Promise<T> => {
  if (!timeoutMs || timeoutMs <= 0) return fn();

  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new TimeoutError(`Task timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    fn()
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
};

const executeTask = async <TInput, TOutput>(
  task: TaskName,
  payload: TInput,
  runner: AgentTask<TInput, TOutput>,
  timeoutMs: number
): Promise<[TaskName, TaskResult<TOutput>]> => {
  const startedAt = Date.now();

  try {
    const output = await withTimeout(() => runner(payload), timeoutMs);
    return [
      task,
      {
        task,
        status: "ok",
        output,
        durationMs: Date.now() - startedAt,
      },
    ];
  } catch (err) {
    return [
      task,
      {
        task,
        status: resolveStatus(err),
        error: err instanceof Error ? err.message : "Unknown error",
        durationMs: Date.now() - startedAt,
      },
    ];
  }
};

export const runAllTasks = async (
  input: OrchestratorInput,
  options: RunAllTasksOptions = {}
): Promise<OrchestratorResult> => {
  const results = new Map<TaskName, TaskResult<unknown>>();
  const scheduled: Array<Promise<[TaskName, TaskResult<unknown>]>> = [];

  const addTask = <TInput, TOutput>(
    task: TaskName,
    payload: TInput | undefined,
    runner: AgentTask<TInput, TOutput>
  ) => {
    if (!payload) {
      results.set(task, {
        task,
        status: "skipped",
        durationMs: 0,
        error: "Task skipped: no input provided",
      });
      return;
    }

    const timeoutMs =
      options.timeouts?.[task] ?? DEFAULT_TIMEOUTS[task] ?? 15_000;
    scheduled.push(
      executeTask(task, payload, runner, timeoutMs) as Promise<
        [TaskName, TaskResult<unknown>]
      >
    );
  };

  addTask("reservas", input.reservas, runReservas);
  addTask("pedidos", input.pedidos, runPedidos);
  addTask("precios", input.precios, runPrecios);
  addTask("carta", input.carta, runCarta);

  const executed = await Promise.all(scheduled);

  for (const [task, result] of executed) {
    results.set(task, result);
  }

  return {
    reservas:
      (results.get("reservas") as TaskResult<ReservasTaskOutput>) ??
      {
        task: "reservas",
        status: "skipped",
        durationMs: 0,
        error: "Task skipped: no input provided",
      },
    pedidos:
      (results.get("pedidos") as TaskResult<PedidosTaskOutput>) ??
      {
        task: "pedidos",
        status: "skipped",
        durationMs: 0,
        error: "Task skipped: no input provided",
      },
    precios:
      (results.get("precios") as TaskResult<PreciosTaskOutput>) ??
      {
        task: "precios",
        status: "skipped",
        durationMs: 0,
        error: "Task skipped: no input provided",
      },
    carta:
      (results.get("carta") as TaskResult<CartaTaskOutput>) ??
      {
        task: "carta",
        status: "skipped",
        durationMs: 0,
        error: "Task skipped: no input provided",
      },
  };
};
