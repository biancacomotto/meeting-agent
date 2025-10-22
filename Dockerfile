# ---------- Base de dependencias ----------
FROM node:20-alpine AS deps
WORKDIR /app
RUN apk add --no-cache libc6-compat
COPY package.json package-lock.json* ./
RUN npm ci

# ---------- Builder ----------
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Genera Prisma Client
RUN npx prisma generate

# Build Next.js
ENV NODE_ENV=production
RUN npm run build

# Remueve dev deps
RUN npm prune --omit=dev

# ---------- Runner ----------
FROM node:20-alpine AS runner
WORKDIR /app

# Herramientas mínimas para healthcheck/entrypoint
RUN apk add --no-cache bash curl

ENV NODE_ENV=production
ENV PORT=3000
# Por defecto, sqlite en prisma/prod.db dentro del contenedor
ENV DATABASE_URL="file:./prisma/prod.db"
ENV LLM_MODEL="gemini-2.5-flash"
# GOOGLE_API_KEY se pasa en runtime

# Copiamos prod deps y build
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma

# Entry point para preparar SQLite y migraciones
COPY docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Healthcheck simple: espera que exista la ruta /api/health
HEALTHCHECK --interval=30s --timeout=3s --start-period=20s --retries=3 \
  CMD curl -fsS "http://127.0.0.1:${PORT}/api/health" || exit 1

EXPOSE 3000
ENTRYPOINT ["/entrypoint.sh"]
CMD ["npm", "run", "start"]
