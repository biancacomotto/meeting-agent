import {
  isSameDay,
  mesaReservas,
  mesas,
  nextMesaId,
  reservas,
} from "../memory/store";

export const mesaRepository = {
  async getAll() {
    return Array.from(mesas.values());
  },

  async getById(id: number) {
    return mesas.get(id) ?? null;
  },

  async create(data: { numero: number; capacidad: number }) {
    const id = nextMesaId();
    const mesa = { id, ...data };
    mesas.set(id, mesa);
    return mesa;
  },

  async getAvailable(fecha: Date, cantidad: number) {
    // reservas del día + sus mesas ocupadas
    const reservasDelDia = Array.from(reservas.values()).filter((r) =>
      isSameDay(r.fecha, fecha)
    );
    const mesasReservadasIds = new Set(
      mesaReservas
        .filter((mr) => reservasDelDia.some((r) => r.id === mr.reservaId))
        .map((mr) => mr.mesaId)
    );

    return Array.from(mesas.values()).filter(
      (m) => !mesasReservadasIds.has(m.id) && m.capacidad >= cantidad
    );
  },
};
