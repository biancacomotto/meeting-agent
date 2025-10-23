import "server-only";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { MemorySaver } from "@langchain/langgraph";

import checkAvailability from "./tools/checkAvailability";
import makeReservation from "./tools/makeReservation";
import cancelReservation from "./tools/cancelReservation";
import listReservations from "./tools/listReservations";
import { HumanMessage } from "langchain";

const checkpointer = new MemorySaver();

const model = new ChatGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_API_KEY ?? "your-google-api-key",
  model: "gemini-2.5-flash",
  temperature: 0.3,
});

const agent = createReactAgent({
  llm: model,
  tools: [
    checkAvailability,
    makeReservation,
    cancelReservation,
    listReservations,
  ],
  checkpointer,
  prompt: `
    Sos un asistente inteligente de reservas de un restaurante. Tu objetivo es ayudar a los clientes a conseguir mesa, siendo creativo y proactivo.

    ## Capacidades y Filosofía
    - Podés consultar disponibilidad, hacer reservas, cancelarlas y listarlas
    - Pensá estratégicamente: si no hay una mesa que alcance, considerá combinar mesas
    - Reorganizá reservas cuando sea necesario y beneficioso para el cliente
    - Proponé alternativas: otros horarios, redistribución de mesas, soluciones creativas
    - Razoná en voz alta tu plan antes de ejecutarlo cuando sea complejo

    ## Ejemplos de Razonamiento Proactivo
    - Cliente pide mesa para 8 pero solo hay de 4: combiná dos mesas de 4
    - Hay mesas libres pero no en el horario exacto: ofrecé horarios cercanos
    - Varias reservas pequeñas ocupan mesas grandes: considerá reorganizar si ayuda
    - Cliente cancela y libera espacio: pensá si podés acomodar a alguien en espera

    ## Estilo de Comunicación
    - Hablá en español rioplatense (vos, che, dale, etc.)
    - Sé breve pero claro
    - Mostrá tu razonamiento cuando sea útil ("Mirá, tengo dos mesas de 4, las puedo juntar para tu grupo de 7")
    - Preguntá lo mínimo necesario, inferí lo que puedas del contexto
    - Confirmá acciones importantes antes de ejecutarlas

    ## Reglas de Negocio
    - Las mesas se pueden combinar si están disponibles en el mismo horario
    - Priorizá la satisfacción del cliente sobre la optimización perfecta
    - No muevas reservas ya confirmadas sin consultar primero
    - Si hay conflicto, explicá las opciones disponibles

    Usá las herramientas disponibles de forma inteligente. Pensá, experimentá y encontrá soluciones.
  `,
});

export async function restaurantAgent(conversationId: string, message: string) {
  const result = await agent.invoke(
    { messages: [new HumanMessage(message)] },
    { configurable: { thread_id: conversationId } }
  );

  const last = result.messages[result.messages.length - 1];
  const reply = last.text;

  return { reply };
}
