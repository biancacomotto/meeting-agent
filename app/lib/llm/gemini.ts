/* eslint-disable @typescript-eslint/ban-ts-comment */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";

export const llm = new ChatGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_API_KEY,
  model: process.env.LLM_MODEL ?? "gemini-2.5-flash",
  // Opcionales:
  // temperature: 0.2,
  // maxOutputTokens: 1024,
  // safetySettings: [...]
});

// Utilidad para extraer texto de la respuesta del LLM (LangChain puede devolver string o bloques)
export function asText(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    // p.ej. [{type:"text", text:"..."}, ...]
    const parts = content
      .map((c: any) =>
        typeof c === "string" ? c : c?.text ?? c?.content ?? c?.value ?? ""
      )
      .join(" ");
    return parts.trim();
  }
  if (typeof content === "object" && content !== null) {
    // intentá campos comunes
    // @ts-expect-error
    return content?.text ?? content?.content ?? JSON.stringify(content);
  }
  return String(content ?? "");
}
