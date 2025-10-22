# ---------- Dependencias ----------
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

# ---------- Build ----------
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build
RUN npm prune --omit=dev

# ---------- Runner ----------
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV DATABASE_URL="file:./prisma/dev.db"
ENV LLM_MODEL="gemini-2.5-flash"

# Copiamos dependencias y build
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma

# 🔑 IMPORTANTE: copiá el client generado en tu ruta custom
COPY --from=builder /app/app/generated ./app/app/generated

# (opcional pero recomendado) regenerar para asegurar binarios musl correctos
RUN npx prisma generate

EXPOSE 3000
CMD ["npm", "run", "start"]
