// Tipos simples
export type Mesa = { id: number; numero: number; capacidad: number };
export type Reserva = {
  id: number;
  nombreReserva: string;
  fecha: Date; // ISO al entrar → Date acá
  cantidadPersonas: number;
};
export type MesaReserva = { mesaId: number; reservaId: number };

// Memoria
export const mesas = new Map<number, Mesa>();
export const reservas = new Map<number, Reserva>();
export const mesaReservas: MesaReserva[] = [];

// Autoincrement
let mesaSeq = 1;
let reservaSeq = 1;

export function nextMesaId() {
  return mesaSeq++;
}
export function nextReservaId() {
  return reservaSeq++;
}

// Util
export function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

// Seed básico (opcional)
(function seed() {
  const seedMesas: Array<Omit<Mesa, "id">> = [
    { numero: 1, capacidad: 2 },
    { numero: 2, capacidad: 2 },
    { numero: 3, capacidad: 4 },
    { numero: 4, capacidad: 4 },
    { numero: 5, capacidad: 6 },
  ];
  seedMesas.forEach((m) => {
    const id = nextMesaId();
    mesas.set(id, { id, ...m });
  });
})();
