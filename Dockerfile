# ---------- Base de deps (con dev deps para build) ----------
FROM node:20-alpine AS deps
WORKDIR /app

# Instalar herramientas necesarias para algunas libs nativas (si hiciera falta)
RUN apk add --no-cache libc6-compat

COPY package.json package-lock.json* ./ 
RUN npm ci

# ---------- Builder (compila Next, genera Prisma Client) ----------
FROM node:20-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Genera Prisma Client (usa tu schema.prisma)
RUN npx prisma generate

# Compila Next.js a producción
ENV NODE_ENV=production
RUN npm run build

# Preparar prod deps (prune dev)
RUN npm prune --omit=dev

# ---------- Runner (ligero, solo prod) ----------
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
# Variables típicas que necesitas (ajustá en runtime):
# ENV GOOGLE_API_KEY=changeme
# ENV DATABASE_URL="file:./prisma/dev.db"
# ENV LLM_MODEL="gemini-2.5-flash"

# Copiamos prod node_modules y build
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

# Copiamos build de Next y assets
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public

# Copiamos Prisma (schema + db sqlite si lo versionás/sembrás)
COPY --from=builder /app/prisma ./prisma

# Healthcheck simple (opcional)
HEALTHCHECK --interval=30s --timeout=3s \
    CMD wget -qO- http://localhost:${PORT}/api/health || exit 1

EXPOSE 3000

# Ejecuta migraciones (si existen) y luego arranca Next
CMD [ "sh", "-c", "npx prisma migrate deploy || true; npm run start" ]
