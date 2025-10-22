import prisma from "../prisma";

export const mesaRepository = {
  async getAll() {
    return prisma.mesa.findMany();
  },

  async getById(id: number) {
    return prisma.mesa.findUnique({ where: { id } });
  },

  async create(data: { numero: number; capacidad: number }) {
    return prisma.mesa.create({ data });
  },

  async getAvailable(fecha: Date, cantidad: number) {
    // Buscar todas las reservas del día con sus mesas
    const reservas = await prisma.reserva.findMany({
      where: {
        fecha: {
          gte: new Date(fecha.setHours(0, 0, 0, 0)),
          lt: new Date(fecha.setHours(23, 59, 59, 999)),
        },
      },
      include: { mesas: true },
    });

    const mesasReservadasIds = reservas.flatMap((r) =>
      r.mesas.map((m) => m.mesaId)
    );

    return prisma.mesa.findMany({
      where: {
        id: { notIn: mesasReservadasIds },
        capacidad: { gte: cantidad },
      },
    });
  },
};
