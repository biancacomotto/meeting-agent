import "server-only";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { MemorySaver } from "@langchain/langgraph";

import {
  appendConversationHistory,
  getConversationHistory,
} from "@/app/lib/db/memory/dbMemory";
import checkAvailability from "./tools/checkAvailability";
import makeReservation from "./tools/makeReservation";
import cancelReservation from "./tools/cancelReservation";
import listReservations from "./tools/listReservations";

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
    Eres un asistente del restaurante.
    Podés reservar, cancelar, listar o consultar disponibilidad de mesas.
    Respondé siempre en español rioplatense, breve y claro.`,
});

export async function restaurantAgent(conversationId: string, message: string) {
  const history = await getConversationHistory(conversationId);

  const result = await agent.invoke(
    { messages: [{ role: "user", content: message }, ...history] },
    { configurable: { thread_id: conversationId } }
  );

  const last = result.messages[result.messages.length - 1];
  const reply = last.text;

  await appendConversationHistory(conversationId, conversationId, [
    { role: "user", content: message, ts: Date.now() },
    { role: "assistant", content: reply, ts: Date.now() },
  ]);

  return { reply };
}
