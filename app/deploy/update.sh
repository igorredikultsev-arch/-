#!/usr/bin/env bash
# Обновление сайта на сервере одной командой:  /opt/avtoslot/app/deploy/update.sh
# Забирает новый код, пересобирает, применяет миграции, перезапускает и чистит старые образы,
# чтобы диск не забивался версиями, которые уже не нужны.
set -euo pipefail
cd "$(dirname "$0")/.."

git pull --ff-only
docker compose build
docker compose run --rm -T migrate </dev/null
docker compose up -d

# Старые образы и кеш сборки старше 3 дней. Свежий кеш оставляем, с ним следующая сборка быстрее.
docker image prune -f >/dev/null
docker builder prune -f --filter until=72h >/dev/null
echo "Готово. Свободно на диске: $(df -h / | awk 'NR==2 {print $4}')"
