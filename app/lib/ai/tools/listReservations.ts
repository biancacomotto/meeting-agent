import { tool } from "@langchain/core/tools";
import z from "zod";
import { reservaRepository } from "@/app/lib/db/repositories/reservaRepository";

const listReservations = tool(
  async ({ date, name }) => {
    const fecha = date ? new Date(date) : null;
    let reservas;
    if (fecha && name) {
      reservas = await reservaRepository.getByNombreAndDate(name, fecha);
    } else if (fecha) {
      reservas = await reservaRepository.getByDate(fecha);
    } else if (name) {
      reservas = await reservaRepository.getByNombre(name);
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
      "Lista reservas por fecha o por nombre de la reserva; si no hay fecha, lista todas las de ese nombre.",
    schema: z.object({
      date: z.string().optional().describe("Fecha (ISO string)"),
      name: z.string().optional().describe("Nombre de la reserva"),
    }),
  }
);

export default listReservations;
