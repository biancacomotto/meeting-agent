import { tool } from "@langchain/core/tools";
import z from "zod";
import { mesaRepository } from "@/app/lib/db/repositories/mesaRepository";

const checkAvailability = tool(
  async ({ date, people }) => {
    const fecha = date ? new Date(date) : new Date();
    const mesas = await mesaRepository.getAvailable(fecha, people ?? 2);
    return mesas.length > 0
      ? `Tengo ${mesas.length} mesa(s) disponibles para ${
          people ?? 2
        } persona(s).`
      : `No tengo mesas disponibles para ${people ?? 2} persona(s).`;
  },
  {
    name: "check_availability",
    description:
      "Verifica disponibilidad de mesas en una fecha y para una cantidad de personas.",
    schema: z.object({
      date: z.string().optional().describe("Fecha de la reserva (ISO string)"),
      people: z.number().optional().describe("Cantidad de personas"),
    }),
  }
);

export default checkAvailability;
