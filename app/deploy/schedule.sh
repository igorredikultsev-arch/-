#!/usr/bin/env bash
# Ночное расписание: резервная копия базы и очистка (просроченные демо в архив, обезличивание старых записей).
# Время — ночь по Перми, в какой бы зоне ни были часы сервера. Строки с пометкой «# avtoslot» в crontab
# переписываются целиком, поэтому скрипт можно запускать сколько угодно раз (его зовут setup.sh и update.sh).
set -euo pipefail
cd "$(dirname "$0")/.."
dir=$PWD

# 02:15 и 02:45 по Перми в часах сервера
at() { date -d "TZ=\"Asia/Yekaterinburg\" $1" '+%-M %-H'; }

chmod +x deploy/backup.sh
( crontab -l 2>/dev/null | grep -v '# avtoslot$' || true
  echo "$(at 02:15) * * * cd $dir && ./deploy/backup.sh >> deploy/backup.log 2>&1 # avtoslot"
  # Очистка прямо в базе, через образ миграций: не зависит от домена и сертификата, ошибка видна в журнале
  echo "$(at 02:45) * * * cd $dir && { date -Is; docker compose run --rm -T migrate npx tsx scripts/cleanup-demos.ts; } >> deploy/cleanup.log 2>&1 # avtoslot"
) | crontab -
