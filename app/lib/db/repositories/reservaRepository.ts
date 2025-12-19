import {
  isSameDay,
  mesaReservas,
  reservas,
  nextReservaId,
  mesas,
  Reserva,
} from "../memory/store";

const normalize = (value: string) => value.trim().toLowerCase();

const hydrateReserva = (reserva: Reserva) => ({
  ...reserva,
  mesas: mesaReservas
    .filter((mr) => mr.reservaId === reserva.id)
    .map((mr) => ({ mesaId: mr.mesaId, mesa: mesas.get(mr.mesaId)! })),
});

export const reservaRepository = {
  async getAll() {
    // Simula include { mesas: { include: { mesa: true } } }
    return Array.from(reservas.values()).map(hydrateReserva);
  },

  async create(data: {
    userId?: string;
    nombreReserva: string;
    fecha: Date;
    cantidadPersonas: number;
  }) {
    const id = nextReservaId();
    const reserva = { id, ...data };
    reservas.set(id, reserva);
    return reserva;
  },

  async getByDate(fecha: Date) {
    const delDia = Array.from(reservas.values()).filter((r) =>
      isSameDay(r.fecha, fecha)
    );
    return delDia.map(hydrateReserva);
  },

  async getByNombre(nombreReserva: string) {
    const target = normalize(nombreReserva);
    const matches = Array.from(reservas.values()).filter(
      (r) => normalize(r.nombreReserva) === target
    );
    return matches.map(hydrateReserva);
  },

  async getByNombreAndDate(nombreReserva: string, fecha: Date) {
    const target = normalize(nombreReserva);
    const matches = Array.from(reservas.values()).filter(
      (r) => normalize(r.nombreReserva) === target && isSameDay(r.fecha, fecha)
    );
    return matches.map(hydrateReserva);
  },

  async delete(id: number) {
    const ex = reservas.get(id);
    if (!ex) throw new Error(`Reserva ${id} no existe`);
    reservas.delete(id);
    // limpiamos relaciones acá o en mesaReservaRepository.deleteByReserva
    for (let i = mesaReservas.length - 1; i >= 0; i--) {
      if (mesaReservas[i].reservaId === id) mesaReservas.splice(i, 1);
    }
    return ex;
  },
};
