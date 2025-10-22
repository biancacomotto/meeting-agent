import { tool } from "@langchain/core/tools";
import z from "zod";
import { reservaRepository } from "@/app/lib/db/repositories/reservaRepository";

const listReservations = tool(
  async ({ date }) => {
    const fecha = date ? new Date(date) : new Date();
    const reservas = await reservaRepository.getByDate(fecha);

    if (reservas.length === 0) return "No hay reservas para esa fecha.";

    const lines = reservas.map(
      (r) =>
        `• ID ${r.id} — ${r.nombreReserva} — ${new Date(r.fecha)
          .toISOString()
          .slice(0, 10)}`
    );

    return `Reservas:\n${lines.join("\n")}`;
  },
  {
    name: "list_reservations",
    description: "Lista todas las reservas de una fecha.",
    schema: z.object({
      date: z.string().optional().describe("Fecha (ISO string)"),
    }),
  }
);

export default listReservations;
