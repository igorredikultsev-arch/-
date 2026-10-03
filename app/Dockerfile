# Зависимости: общий слой для миграций и сборки
FROM node:22-bookworm-slim AS deps
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# Миграции и служебные скрипты (docker compose run migrate). Без next build: собирается за минуту и почти без памяти
FROM deps AS migrator
COPY . .
RUN npx prisma generate

# Сборка: клиент Prisma → next build (standalone)
FROM deps AS builder
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npx prisma generate && npx next build

# Запуск: только собранное приложение, без исходников и dev-зависимостей
FROM node:22-bookworm-slim AS runner
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
RUN useradd --system --uid 1001 app
COPY --from=builder --chown=app /app/.next/standalone ./
COPY --from=builder --chown=app /app/.next/static ./.next/static
COPY --from=builder --chown=app /app/public ./public
USER app
EXPOSE 3000
CMD ["node", "server.js"]
