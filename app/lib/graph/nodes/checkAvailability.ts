import { mesaRepository } from "../../db/repositories/mesaRepository";

export async function checkAvailability({
  fecha,
  cantidadPersonas,
}: {
  fecha: string;
  cantidadPersonas: number;
}) {
  const mesasLibres = await mesaRepository.getAvailable(
    new Date(fecha),
    cantidadPersonas
  );

  return {
    disponible: mesasLibres.length > 0,
    mesasLibres,
  };
}
