import { isSameDay, mesaReservas, reservas } from "../memory/store";

export const mesaReservaRepository = {
  async create(data: { mesaId: number; reservaId: number }) {
    mesaReservas.push({ ...data });
    return data;
  },

  async deleteByReserva(reservaId: number) {
    for (let i = mesaReservas.length - 1; i >= 0; i--) {
      if (mesaReservas[i].reservaId === reservaId) mesaReservas.splice(i, 1);
    }
    return { count: 1 };
  },

  async findByMesaAndDate(mesaId: number, fecha: Date) {
    const match = mesaReservas.find((mr) => {
      const r = reservas.get(mr.reservaId);
      return r && mr.mesaId === mesaId && isSameDay(r.fecha, fecha);
    });
    return match ?? null;
  },
};
