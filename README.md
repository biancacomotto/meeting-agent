# Meeting Agent - Restaurante multiagente

Sistema de agentes para un restaurante que resuelve reservas, pedidos y ajustes de precios. El flujo sigue un estilo n8n: un Agent principal decide y llama a Agent Tools especializados. Incluye memoria por conversacion y un modulo RAG liviano con una base interna.

## Problema a resolver
Clientes preguntan y piden cosas variadas (reservas, pedidos, precios, horarios, pagos). Un solo agente lineal es fragil. El objetivo es enrutar cada mensaje al agente correcto y responder de forma natural, con memoria y contexto.

## Criterio de exito
- Respuestas en espanol rioplatense, sin JSON en pantalla.
- Seleccion correcta del subagente (reservas/pedidos/precios).
- Memoria por conversacion (no perder datos entre turnos).
- Uso de conocimiento interno (horarios, menu, politicas).
- Capaz de operar con datos incompletos, preguntando lo minimo.

## Arquitectura
**Nodo Agent (router)** -> **Agent Tools**:
- Reservas: disponibilidad, confirmacion y alternativas.
- Pedidos: confirmacion de items y direccion.
- Precios: sugerencias de ajustes con contexto.

Extension aplicada:
- **RAG liviano**: `app/lib/ai/knowledge` contiene documentos internos. Se recupera contexto relevante por overlap de tokens y se inyecta al router.
- **Memoria por conversacion**: `MemorySaver` en router y agentes, con `thread_id` por conversacion.
- **Multiagentes**: enrutamiento y herramientas especializadas.

## Endpoints
- `POST /api/ai/ask` (chat principal)
  - Body: `{ "conversation_id": "id", "message": "texto" }`
- `POST /api/ai/eval` (evaluacion)
  - Body opcional: `{ "cases": [...] }`
  - Sin body usa casos en `app/lib/ai/eval/cases.ts`

## Evaluacion
La evaluacion corre casos deterministas con reglas simples:
- agente esperado
- no mostrar JSON
- preguntar cuando falta info
- incluir palabras clave

Ver `app/lib/ai/eval`.

Ejemplo:
```bash
curl -s -X POST http://localhost:3000/api/ai/eval | jq
```

## Setup
```bash
npm install
npm run dev
```

Variables de entorno:
```
GOOGLE_API_KEY=...
```

## Deploy (Railway)
1. Crear proyecto en Railway y conectar repo de GitHub.
2. Agregar variable `GOOGLE_API_KEY`.
3. Railway detecta Next.js automaticamente.

## Archivos clave
- Router: `app/lib/ai/orchestrator/router.ts`
- Agentes: `app/lib/ai/agents/*/agent.ts`
- RAG: `app/lib/ai/knowledge/*`
- Evaluacion: `app/lib/ai/eval/*`

## Notas de diseno
- El router solo envia system prompt en el primer turno por conversacion.
- Los agentes nunca devuelven JSON al usuario final.
