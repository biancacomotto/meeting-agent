import { EvalCase } from "./types";

export const evalCases: EvalCase[] = [
  {
    id: "reserva-basica",
    description: "Reserva con datos completos",
    conversationId: "eval-reserva-1",
    turns: ["Quiero una mesa para 2 manana a las 21, a nombre de Julia."],
    expectedAgent: "reservas",
    mustNotIncludeJson: true,
  },
  {
    id: "reserva-memoria",
    description: "Memoria de datos faltantes en reserva",
    conversationId: "eval-reserva-2",
    turns: [
      "Quiero reservar para 4 manana a la noche.",
      "A nombre de Pedro.",
    ],
    expectedAgent: "reservas",
    mustNotIncludeJson: true,
  },
  {
    id: "pedido-basico",
    description: "Pedido con items y direccion",
    conversationId: "eval-pedido-1",
    turns: [
      "Quiero 1 pizza muzarella y 2 flanes, direccion Amenabar 4450.",
    ],
    expectedAgent: "pedidos",
    mustNotIncludeJson: true,
  },
  {
    id: "pedido-incompleto",
    description: "Pedido sin direccion",
    conversationId: "eval-pedido-2",
    turns: ["Quiero 6 empanadas y una coca."],
    expectedAgent: "pedidos",
    mustAskQuestion: true,
    mustNotIncludeJson: true,
  },
  {
    id: "precios-catalogo",
    description: "Precios sin productos (debe usar catalogo)",
    conversationId: "eval-precios-1",
    turns: ["Necesito ajustar precios por suba de costos."],
    expectedAgent: "precios",
    mustNotIncludeJson: true,
  },
  {
    id: "info-horarios",
    description: "Consulta de horarios via RAG",
    conversationId: "eval-info-1",
    turns: ["Que horarios tienen hoy?"],
    expectedAgent: "reservas",
    mustNotIncludeJson: true,
  },
];
