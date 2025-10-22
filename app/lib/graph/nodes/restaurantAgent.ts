/* eslint-disable @typescript-eslint/no-explicit-any */

import {
  appendConversationHistory,
  getConversationHistory,
  getCustomerState,
  upsertCustomerState,
} from "../../db/memory/dbMemory";
import { asText, llm } from "../../llm/gemini";
import { actions } from "../tools/actions";
import { classifyIntent } from "./classifyIntent";
import { formatResponse } from "./formatResponse";

type AgentInput = {
  customerId: string;
  message: string;
  context?: Record<string, any>;
};

export async function runRestaurantAgent(input: AgentInput) {
  // Usamos el customerId como clave de "conversación" para WhatsApp
  const convKey = input.customerId;

  // 1) cargar memoria
  const [state, history] = await Promise.all([
    getCustomerState(input.customerId),
    getConversationHistory(convKey),
  ]);

  // 2) clasificar + extraer entidades (pasando memoria/historial para más precisión)
  const { intent, entities } = await classifyIntent({
    message: input.message,
    history,
    state,
  });

  // 3) router de acciones
  const performed: string[] = [];
  let actionOutput: any;

  try {
    switch (intent) {
      case "RESERVAR":
        actionOutput = await actions.createReservation(entities);
        performed.push("createReservation");
        break;
      case "DISPONIBILIDAD":
        actionOutput = await actions.checkAvailability(entities);
        performed.push("checkAvailability");
        break;
      case "CONSULTAR":
        actionOutput = await actions.consultarReservas(entities);
        performed.push("consultarReservas");
        break;
      case "CANCELAR":
        if (actions.cancelReservation) {
          actionOutput = await actions.cancelReservation(entities);
          performed.push("cancelReservation");
        } else {
          actionOutput = {
            message: "Puedo cancelar si me pasás el ID de reserva.",
          };
          performed.push("noopCancel");
        }
        break;
      case "SALUDO":
        actionOutput = {
          message: "¡Hola! ¿Para qué fecha y cuántas personas?",
        };
        performed.push("smalltalk");
        break;
      default: {
        // Fallback libre con Gemini
        const reply = await llm.invoke([
          {
            role: "system",
            content: "Sé breve, claro y profesional. Español rioplatense.",
          },
          ...history.map((h) => ({
            role: h.role as "user" | "assistant",
            content: h.content,
          })),
          { role: "user", content: input.message },
        ]);
        actionOutput = { message: asText(reply.content) || "Entendido." };
        performed.push("llmFallback");
      }
    }
  } finally {
    // 4) persistir memoria (estado mínimo + buffer)
    await Promise.all([
      upsertCustomerState(input.customerId, {
        lastIntent: intent,
        lastMessageAt: new Date().toISOString(),
        lastPeople: entities?.cantidadPersonas ?? state.lastPeople,
        lastName: entities?.nombreReserva ?? state.lastName,
        lastDate: entities?.fecha ?? state.lastDate,
      }),
      appendConversationHistory(convKey, input.customerId, [
        { role: "user", content: input.message, ts: Date.now() },
      ]),
    ]);
  }

  // 5) redacción final (Gemini)
  const reply = await formatResponse({
    intent,
    entities,
    actionOutput,
    state,
    context: input.context ?? {},
  });

  // 6) guardar respuesta en la memoria de conversación
  await appendConversationHistory(convKey, input.customerId, [
    { role: "assistant", content: reply, ts: Date.now() },
  ]);

  return { reply, meta: { intent, entities, performed } };
}
