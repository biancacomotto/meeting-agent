/* eslint-disable @typescript-eslint/no-explicit-any */
import { runRestaurantAgent } from "@/app/lib/graph/nodes/restaurantAgent";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const BodySchema = z.object({
  customerId: z.string().min(1, "customerId requerido"),
  message: z.string().min(1, "message requerido"),
  replyEndpoint: z.string().url().optional(), // si viene, posteamos la respuesta ahí
});

export async function POST(req: NextRequest) {
  try {
    const json = await req.json();
    const { customerId, message, replyEndpoint } = BodySchema.parse(json);

    // Ejecuta el agente end-to-end (Gemini): clasifica → actúa → redacta
    const result = await runRestaurantAgent({
      customerId,
      message,
    });

    // (Opcional) responder a un webhook externo si lo enviás en el body
    if (replyEndpoint) {
      await fetch(replyEndpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          chatId: customerId, // usamos customerId como clave de hilo en WhatsApp
          reply: result.reply,
          meta: result.meta,
        }),
      });
    }

    // Respuesta HTTP (útil para pruebas y fallback)
    return NextResponse.json({
      ok: true,
      reply: result.reply,
      meta: result.meta,
    });
  } catch (err: any) {
    console.error("[/api/ai] error:", err);
    const msg = err?.message ?? "Unhandled error";
    return NextResponse.json({ ok: false, error: msg }, { status: 400 });
  }
}
