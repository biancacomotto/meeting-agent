import { tool } from "@langchain/core/tools";
import z from "zod";
import { mesaRepository } from "@/app/lib/db/repositories/mesaRepository";
import { reservaRepository } from "@/app/lib/db/repositories/reservaRepository";
import { mesaReservaRepository } from "@/app/lib/db/repositories/mesaReservaRepository";

const makeReservation = tool(
  async ({ name, date, people }) => {
    const fecha = date ? new Date(date) : new Date();
    const mesas = await mesaRepository.getAvailable(fecha, people ?? 2);

    if (mesas.length === 0)
      return `No hay mesas disponibles para ${people ?? 2} persona(s).`;

    const reserva = await reservaRepository.create({
      nombreReserva: name ?? "Invitado",
      fecha,
      cantidadPersonas: people ?? 2,
    });

    const mesa = mesas[0];
    await mesaReservaRepository.create({
      mesaId: mesa.id,
      reservaId: reserva.id,
    });

    return `Reserva creada para ${name ?? "Invitado"} el ${fecha
      .toISOString()
      .slice(0, 10)}. Mesa ${mesa.numero}. Código ${reserva.id}.`;
  },
  {
    name: "make_reservation",
    description:
      "Crea una reserva de mesa con nombre, fecha y cantidad de personas.",
    schema: z.object({
      name: z.string().optional().describe("Nombre de la reserva"),
      date: z.string().optional().describe("Fecha de la reserva (ISO string)"),
      people: z.number().optional().describe("Cantidad de personas"),
    }),
  }
);

export default makeReservation;
