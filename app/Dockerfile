# Зависимости: общий слой для миграций и сборки
FROM node:22-bookworm-slim AS deps
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# Миграции и служебные скрипты (docker compose run migrate). Только Prisma, tsx и то, что импортируют скрипты:
# без Next.js и остальных зависимостей сайта образ в несколько раз меньше и быстрее скачивается на сервер.
# Версии берутся из package-lock.json, как у сайта
FROM node:22-bookworm-slim AS migrator
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
RUN node -e "const l=require('./package-lock.json').packages, o=require('./package.json').overrides; \
const pick=['prisma','@prisma/client','tsx','@node-rs/argon2','dotenv']; \
const deps=Object.fromEntries(pick.map((n)=>[n,l['node_modules/'+n].version])); \
require('fs').writeFileSync('package.json',JSON.stringify({name:'avtoslot-migrate',private:true,dependencies:deps,overrides:o},null,2))" \
 && rm package-lock.json \
 && npm install --no-audit --no-fund && npm cache clean --force
COPY prisma ./prisma
COPY prisma.config.ts tsconfig.json ./
COPY scripts ./scripts
COPY src/lib ./src/lib
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
