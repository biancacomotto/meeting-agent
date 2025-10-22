import { z } from "zod";

export const ReservaInputSchema = z.object({
  nombreReserva: z.string().min(2),
  fecha: z.string().datetime(),
  cantidadPersonas: z.number().min(1),
});

export type ReservaInput = z.infer<typeof ReservaInputSchema>;

export function validateInput(input: unknown): ReservaInput {
  const parsed = ReservaInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error("Datos de reserva inválidos");
  }
  const fecha = new Date(parsed.data.fecha);
  if (fecha <= new Date()) throw new Error("La fecha debe ser futura");
  return parsed.data;
}
