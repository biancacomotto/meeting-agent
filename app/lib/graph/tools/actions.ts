/* eslint-disable @typescript-eslint/no-explicit-any */
import prisma from "../../db/prisma";
import { checkAvailability as _checkAvailability } from "../nodes/checkAvailability";
import { createReservation as _createReservation } from "../nodes/createReservation";
import { validateInput as _validateInput } from "../nodes/validateInput";

export const actions = {
  async checkAvailability(entities: any) {
    const { fecha, cantidadPersonas } = entities ?? {};
    if (!fecha || !cantidadPersonas)
      return { message: "Decime fecha y cantidad de personas para chequear." };

    const res = await _checkAvailability({
      fecha,
      cantidadPersonas: Number(cantidadPersonas),
    });

    if (!res.disponible)
      return { message: "No veo mesas libres para ese horario." };
    return {
      disponible: true,
      mesasLibres: res.mesasLibres,
      message: `Hay disponibilidad. Mesas sugeridas: ${res.mesasLibres
        .map((m: any) => m.numero)
        .join(", ")}.`,
    };
  },

  async createReservation(entities: any) {
    const valid = _validateInput({
      nombreReserva: entities?.nombreReserva,
      fecha: entities?.fecha,
      cantidadPersonas: Number(entities?.cantidadPersonas),
    });

    const mesaId =
      entities?.mesaId ??
      entities?.mesasLibres?.[0]?.id ??
      entities?.mesaIdSugerida;

    if (!mesaId)
      return { message: "Indicá la mesa a asignar (o dejá que sugiera una)." };

    const reserva = await _createReservation({
      nombreReserva: valid.nombreReserva,
      fecha: valid.fecha,
      cantidadPersonas: valid.cantidadPersonas,
      mesaId: Number(mesaId),
    });

    return {
      message: `Reserva creada para ${reserva.cantidadPersonas} el ${new Date(
        reserva.fecha
      ).toLocaleString()}.`,
      reserva,
    };
  },

  // NUEVO: consultar reservas (por fecha/nombre; si no viene fecha → próximas 30 días)
  async consultarReservas(entities: any) {
    const { fecha, nombreReserva } = entities ?? {};
    const where: any = {};

    if (fecha) {
      const d = new Date(fecha);
      const start = new Date(d);
      start.setHours(0, 0, 0, 0);
      const end = new Date(d);
      end.setHours(23, 59, 59, 999);
      where.fecha = { gte: start, lte: end };
    } else {
      const now = new Date();
      const horizon = new Date();
      horizon.setDate(now.getDate() + 30);
      where.fecha = { gte: now, lte: horizon };
    }
    if (nombreReserva) where.nombreReserva = { equals: nombreReserva };

    const reservas = await prisma.reserva.findMany({
      where,
      orderBy: { fecha: "asc" },
      include: { mesas: { include: { mesa: true } } },
    });

    if (!reservas.length)
      return { message: "No encontré reservas en ese rango.", reservas: [] };

    const resumen = reservas.map((r) => {
      const mesas = r.mesas.map((m) => m.mesa.numero).join(", ");
      return `#${r.id} • ${new Date(r.fecha).toLocaleString()} • ${
        r.cantidadPersonas
      }p • Mesas: ${mesas}`;
    });

    return {
      message: `Tengo estas reservas:\n- ${resumen.join("\n- ")}`,
      reservas,
    };
  },

  // (Opcional) cancelar; implementalo si lo necesitás
  async cancelReservation(entities: any) {
    const id = Number(entities?.reservaId);
    if (!id) return { message: "Necesito el ID de la reserva a cancelar." };
    await prisma.mesaReserva.deleteMany({ where: { reservaId: id } });
    await prisma.reserva.delete({ where: { id } });
    return { message: `Reserva #${id} cancelada.` };
  },
};
