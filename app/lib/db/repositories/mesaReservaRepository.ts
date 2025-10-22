import prisma from "../prisma";

export const mesaReservaRepository = {
  async create(data: { mesaId: number; reservaId: number }) {
    return prisma.mesaReserva.create({ data });
  },

  async deleteByReserva(reservaId: number) {
    return prisma.mesaReserva.deleteMany({ where: { reservaId } });
  },

  async findByMesaAndDate(mesaId: number, fecha: Date) {
    return prisma.mesaReserva.findFirst({
      where: {
        mesaId,
        reserva: {
          fecha: {
            gte: new Date(fecha.setHours(0, 0, 0, 0)),
            lt: new Date(fecha.setHours(23, 59, 59, 999)),
          },
        },
      },
    });
  },
};
