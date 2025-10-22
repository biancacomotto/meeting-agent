/* eslint-disable @typescript-eslint/no-explicit-any */
import { z } from "zod";
import { asText, llm } from "../../llm/gemini";

const IntentSchema = z.object({
  intent: z.enum([
    "RESERVAR",
    "DISPONIBILIDAD",
    "CONSULTAR",
    "CANCELAR",
    "SALUDO",
    "OTRO",
  ]),
  entities: z
    .object({
      nombreReserva: z.string().optional(),
      fecha: z.string().optional(), // ISO o texto “mañana 21”
      cantidadPersonas: z.coerce.number().optional(),
      mesaId: z.coerce.number().optional(),
      reservaId: z.coerce.number().optional(),
    })
    .partial()
    .optional(),
});

export async function classifyIntent(args: {
  message: string;
  history?: any[];
  state?: Record<string, any>;
}): Promise<{ intent: any; entities: Record<string, any> }> {
  const sys =
    "Sos un router de intents para un restaurante. Devolvé JSON estricto {intent, entities}. " +
    "Intents: RESERVAR, DISPONIBILIDAD, CONSULTAR (listar reservas), CANCELAR, SALUDO, OTRO. " +
    "Extraé entidades (nombreReserva, fecha, cantidadPersonas, mesaId, reservaId). " +
    "Si no hay datos suficientes, inferí desde state/history. Respondé SOLO JSON válido.";

  const messages: { role: "system" | "user" | "assistant"; content: string }[] =
    [
      { role: "system", content: sys },
      ...(args.history ?? [])
        .slice(-6)
        .map((h) => ({ role: h.role, content: h.content })),
      { role: "user", content: `state=${JSON.stringify(args.state ?? {})}` },
      { role: "user", content: args.message },
    ];

  const chat = await llm.invoke(messages);
  const raw = asText(chat.content) || "{}";

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    // Intento de reparación mínima si vino con ruido
    const fixed = raw
      .trim()
      .replace(/^[^\{]+/, "")
      .replace(/[^\}]+$/, "");
    try {
      json = JSON.parse(fixed);
    } catch {
      return { intent: "OTRO", entities: {} };
    }
  }

  const parsed = IntentSchema.safeParse(json);
  if (!parsed.success) return { intent: "OTRO", entities: {} };

  const ent = parsed.data.entities ?? {};
  return { intent: parsed.data.intent, entities: ent };
}
