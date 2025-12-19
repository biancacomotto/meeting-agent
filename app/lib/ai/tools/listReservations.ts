import { tool } from "@langchain/core/tools";
import z from "zod";
import { reservaRepository } from "@/app/lib/db/repositories/reservaRepository";

const listReservations = tool(
  async ({ date, userId }) => {
    const fecha = date ? new Date(date) : null;
    let reservas;
    if (fecha && userId) {
      reservas = await reservaRepository.getByUserIdAndDate(userId, fecha);
    } else if (fecha) {
      reservas = await reservaRepository.getByDate(fecha);
    } else if (userId) {
      reservas = await reservaRepository.getByUserId(userId);
    } else {
      reservas = await reservaRepository.getAll();
    }

    if (reservas.length === 0) return "No hay reservas para ese criterio.";

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
    description:
      "Lista reservas por fecha o por ID de usuario; si no hay fecha, lista todas las de ese usuario.",
    schema: z.object({
      date: z.string().optional().describe("Fecha (ISO string)"),
      userId: z.string().optional().describe("ID del usuario/cliente"),
    }),
  }
);

export default listReservations;
