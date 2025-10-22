import { tool } from "@langchain/core/tools";
import z from "zod";
import { mesaReservaRepository } from "@/app/lib/db/repositories/mesaReservaRepository";
import { reservaRepository } from "@/app/lib/db/repositories/reservaRepository";

const cancelReservation = tool(
  async ({ id }) => {
    await mesaReservaRepository.deleteByReserva(id);
    await reservaRepository.delete(id);
    return `Reserva ${id} cancelada correctamente.`;
  },
  {
    name: "cancel_reservation",
    description: "Cancela una reserva existente por su ID.",
    schema: z.object({
      id: z.number().describe("ID de la reserva a cancelar"),
    }),
  }
);

export default cancelReservation;
