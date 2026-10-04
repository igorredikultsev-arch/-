#!/usr/bin/env bash
# Восстановление базы из копии. Текущая база стирается и заменяется копией (перед этим с неё снимается копия).
#   ./deploy/restore.sh deploy/backups/avtoslot-20261004-0215.sql.gz
# Копии: deploy/backups/avtoslot-*.sql.gz (каждую ночь) и before-update-*.sql.gz (перед каждым обновлением).
set -euo pipefail
cd "$(dirname "$0")/.."

f=${1:?Укажите файл копии, например: ./deploy/restore.sh deploy/backups/avtoslot-20261004-0215.sql.gz}
gzip -t "$f" || { echo "Файл $f повреждён или это не копия базы" >&2; exit 1; }
if [[ "${2:-}" != "--yes" ]]; then
  read -r -p "База сайта будет заменена копией $(basename "$f"). Продолжить? Напишите да: " ok </dev/tty
  [[ $ok == "да" ]] || { echo "Отменено"; exit 1; }
fi

docker compose up -d --wait db >/dev/null
mkdir -p deploy/backups
now="deploy/backups/before-restore-$(date +%Y%m%d-%H%M%S).sql.gz"
docker compose exec -T db pg_dump -U avtoslot avtoslot | gzip > "$now"
echo "Текущая база сохранена: $now"

docker compose stop app
docker compose exec -T db psql -q -U avtoslot -d postgres -v ON_ERROR_STOP=1 \
  -c 'DROP DATABASE IF EXISTS avtoslot WITH (FORCE)' -c 'CREATE DATABASE avtoslot OWNER avtoslot'
gunzip -c "$f" | docker compose exec -T db psql -q -U avtoslot -d avtoslot -v ON_ERROR_STOP=1 --single-transaction >/dev/null
# Копия могла быть снята со старой версии: догоняем схему базы до текущей
docker compose run --rm -T migrate </dev/null
docker compose up -d app
echo "Готово: база восстановлена из $(basename "$f")"
