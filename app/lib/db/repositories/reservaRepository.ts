import prisma from "../prisma";

export const reservaRepository = {
  async getAll() {
    return prisma.reserva.findMany({
      include: { mesas: { include: { mesa: true } } },
    });
  },

  async create(data: {
    nombreReserva: string;
    fecha: Date;
    cantidadPersonas: number;
  }) {
    return prisma.reserva.create({ data });
  },

  async getByDate(fecha: Date) {
    return prisma.reserva.findMany({
      where: {
        fecha: {
          gte: new Date(fecha.setHours(0, 0, 0, 0)),
          lt: new Date(fecha.setHours(23, 59, 59, 999)),
        },
      },
      include: { mesas: { include: { mesa: true } } },
    });
  },

  async delete(id: number) {
    return prisma.reserva.delete({ where: { id } });
  },
};
