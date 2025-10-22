import { mesaReservaRepository } from "../../db/repositories/mesaReservaRepository";
import { reservaRepository } from "../../db/repositories/reservaRepository";

export async function createReservation({
  nombreReserva,
  fecha,
  cantidadPersonas,
  mesaId,
}: {
  nombreReserva: string;
  fecha: string;
  cantidadPersonas: number;
  mesaId: number;
}) {
  const reserva = await reservaRepository.create({
    nombreReserva,
    fecha: new Date(fecha),
    cantidadPersonas,
  });

  await mesaReservaRepository.create({
    mesaId,
    reservaId: reserva.id,
  });

  return reserva;
}
