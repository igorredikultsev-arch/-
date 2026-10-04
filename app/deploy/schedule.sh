#!/usr/bin/env bash
# Расписание: ночью по Перми копия базы и очистка (просроченные демо в архив, обезличивание старых записей),
# раз в 5 минут — отметка в мониторинге, если задан HEALTHCHECK_URL.
# Время — ночь по Перми, в какой бы зоне ни были часы сервера. Строки с пометкой «# avtoslot» в crontab
# переписываются целиком, поэтому скрипт можно запускать сколько угодно раз (его зовут setup.sh и update.sh).
set -euo pipefail
cd "$(dirname "$0")/.."
dir=$PWD

# 02:15 и 02:45 по Перми в часах сервера
at() { date -d "TZ=\"Asia/Yekaterinburg\" $1" '+%-M %-H'; }
env_value() { sed -n "s/^$1=//p" .env | tr -d "\"'" | tail -1; }
root=$(env_value ROOT_DOMAIN)
hc=$(env_value HEALTHCHECK_URL)

chmod +x deploy/backup.sh
( crontab -l 2>/dev/null | grep -v '# avtoslot$' || true
  echo "$(at 02:15) * * * cd $dir && ./deploy/backup.sh >> deploy/backup.log 2>&1 # avtoslot"
  # Очистка прямо в базе, через образ миграций: не зависит от домена и сертификата, ошибка видна в журнале
  echo "$(at 02:45) * * * cd $dir && { date -Is; docker compose run --rm -T migrate npx tsx scripts/cleanup-demos.ts; } >> deploy/cleanup.log 2>&1 # avtoslot"
  # Мониторинг: раз в 5 минут этот сервер проверяет себя (HTTPS, сайт, база) и отмечается в Healthchecks.
  # Отметки перестали приходить (упал сайт, база, сертификат или пропала сеть) — Healthchecks пишет вам
  if [[ -n $hc && -n $root ]]; then
    echo "*/5 * * * * curl -fsS -m 10 --resolve $root:443:127.0.0.1 https://$root/api/health >/dev/null && curl -fsS -m 10 --retry 3 -o /dev/null $hc # avtoslot"
  fi
) | crontab -
