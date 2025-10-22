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
# Usa la base SQLite incluida
ENV DATABASE_URL="file:./prisma/dev.db"
ENV LLM_MODEL="gemini-2.5-flash"

# Copiamos dependencias y build
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma

# Si querés renombrar la base dentro del contenedor (opcional)
# RUN cp ./prisma/dev.db ./prisma/prod.db
# ENV DATABASE_URL="file:./prisma/prod.db"

EXPOSE 3000
CMD ["npm", "run", "start"]
