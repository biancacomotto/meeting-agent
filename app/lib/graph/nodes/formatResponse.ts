/* eslint-disable @typescript-eslint/no-explicit-any */

import { asText, llm } from "../../llm/gemini";

export async function formatResponse(args: {
  intent: string;
  entities?: any;
  actionOutput?: any;
  state?: any;
  context?: any;
}): Promise<string> {
  if (args?.actionOutput?.message) return args.actionOutput.message;

  const sys =
    "Sos un asistente de restaurante. Respuestas cortas, claras y profesionales.";
  const user =
    `Intent: ${args.intent}\n` +
    `Entities: ${JSON.stringify(args.entities)}\n` +
    `Data: ${JSON.stringify(args.actionOutput)}\n` +
    `State: ${JSON.stringify(args.state)}`;

  const chat = await llm.invoke([
    { role: "system", content: sys },
    { role: "user", content: user },
  ]);

  return asText(chat.content) || "Listo.";
}
