export type KnowledgeDoc = {
  id: string;
  title: string;
  text: string;
  tags: string[];
};

export const knowledgeDocs: KnowledgeDoc[] = [
  {
    id: "menu-core",
    title: "Menu y combos",
    text: [
      "Platos principales: milanesa napolitana con fritas, pizza muzarella a la piedra, bife con ensalada.",
      "Entradas: provoleta, empanadas criollas, buchetas caprese.",
      "Postres: flan casero con dulce, brownie con helado.",
      "Combos delivery: box de 6 empanadas, combo pizza + gaseosa.",
    ].join(" "),
    tags: ["menu", "productos", "delivery"],
  },
  {
    id: "reservas-reglas",
    title: "Reglas de reservas",
    text: [
      "Reservas hasta las 23:00.",
      "Si no hay mesa exacta, se pueden combinar mesas disponibles en el mismo horario.",
      "No se mueve una reserva confirmada sin pedir permiso.",
    ].join(" "),
    tags: ["reservas", "politicas", "horarios"],
  },
  {
    id: "horarios",
    title: "Horarios del local",
    text: [
      "Lunes a jueves: 12:00 a 15:30 y 19:00 a 23:00.",
      "Viernes y sabados: 12:00 a 16:00 y 19:00 a 00:30.",
      "Domingo: 12:00 a 16:00 y 19:00 a 23:00.",
    ].join(" "),
    tags: ["horarios", "atencion"],
  },
  {
    id: "delivery-info",
    title: "Delivery y tiempos",
    text: [
      "Delivery en zona norte y oeste.",
      "Tiempo promedio: 35 a 45 minutos.",
      "Pedidos grandes pueden demorar un poco mas.",
    ].join(" "),
    tags: ["delivery", "tiempos", "pedidos"],
  },
  {
    id: "pagos",
    title: "Medios de pago",
    text: [
      "Aceptamos efectivo, tarjeta y transferencia.",
      "En delivery se puede pagar con link de pago.",
    ].join(" "),
    tags: ["pagos", "caja"],
  },
];
