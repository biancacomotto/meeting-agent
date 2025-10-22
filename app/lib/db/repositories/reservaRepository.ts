import {
  isSameDay,
  mesaReservas,
  reservas,
  nextReservaId,
  mesas,
} from "../memory/store";

export const reservaRepository = {
  async getAll() {
    // Simula include { mesas: { include: { mesa: true } } }
    return Array.from(reservas.values()).map((r) => ({
      ...r,
      mesas: mesaReservas
        .filter((mr) => mr.reservaId === r.id)
        .map((mr) => ({ mesaId: mr.mesaId, mesa: mesas.get(mr.mesaId)! })),
    }));
  },

  async create(data: {
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
    return delDia.map((r) => ({
      ...r,
      mesas: mesaReservas
        .filter((mr) => mr.reservaId === r.id)
        .map((mr) => ({ mesaId: mr.mesaId, mesa: mesas.get(mr.mesaId)! })),
    }));
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
