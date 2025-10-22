import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const mesas = [
    { numero: 1, capacidad: 2 },
    { numero: 2, capacidad: 4 },
    { numero: 3, capacidad: 4 },
    { numero: 4, capacidad: 6 },
    { numero: 5, capacidad: 8 },
  ];

  for (const mesa of mesas) {
    await prisma.mesa.upsert({
      where: { numero: mesa.numero },
      update: {},
      create: mesa,
    });
  }

  console.log("Mesas iniciales cargadas.");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
