# Продакшен-образ: один контейнер отдаёт и API, и собранный фронтенд.
# Сборка: docker build -t timing .   Запуск: см. docker-compose.prod.yml

# ── 1. Фронтенд ──────────────────────────────────────────────────────────────────
FROM node:22-alpine AS client
WORKDIR /client
COPY client/package*.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

# ── 2. Сервер ────────────────────────────────────────────────────────────────────
FROM node:22-alpine AS server
WORKDIR /server
COPY server/package*.json ./
COPY server/prisma ./prisma
RUN npm ci
COPY server/ ./
RUN npm run build && npm prune --omit=dev

# ── 3. Итоговый образ ────────────────────────────────────────────────────────────
FROM node:22-alpine
ENV NODE_ENV=production PORT=3000 CLIENT_DIST=/app/public
WORKDIR /app
COPY --from=server /server/node_modules ./node_modules
COPY --from=server /server/dist ./dist
COPY --from=server /server/prisma ./prisma
COPY --from=server /server/package.json ./
COPY --from=client /client/dist ./public
EXPOSE 3000
# Миграции применяются при каждом старте (идемпотентно)
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
