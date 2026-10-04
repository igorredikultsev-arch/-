#!/usr/bin/env bash
# Обновление сайта на сервере одной командой:  /opt/avtoslot/app/deploy/update.sh
# Забирает новый код, скачивает готовые образы из GitHub Container Registry (их собирает
# GitHub Actions, сервер ничего не собирает), применяет миграции, перезапускает и чистит старые образы.
#
#   update.sh            — до последнего коммита ветки
#   update.sh <коммит>   — до этого коммита (так зовёт autoupdate.sh, уже проверенный коммит)
#   update.sh --build    — крайний случай, если ghcr.io недоступен: собрать образы здесь (10-15 минут,
#                          сайт на это время может перестать отвечать)
#
# Коды выхода: 0 — готово, 3 — образы для коммита ещё не готовы или не скачались (можно повторить позже),
# остальное — ошибка обновления (сайт остаётся на прошлой версии). Если новая версия запустилась, но не отвечает,
# скрипт сам возвращает прошлую.
set -euo pipefail

env_value() { sed -n "s/^$1=//p" .env | tr -d "\"'" | tail -1; }

# Сайт внутри контейнера отвечает на /login (до 60 секунд ожидания)
site_ok() {
  local i
  for i in $(seq 1 30); do
    if docker compose exec -T app node -e "fetch('http://127.0.0.1:3000/login').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" >/dev/null 2>&1; then
      return 0
    fi
    sleep 2
  done
  return 1
}

# Всё в функции: git ниже может поменять этот файл, а bash читает скрипт по ходу выполнения
main() {
  cd "$(dirname "$0")/.."
  local build=0 target="" IMAGE
  # Пакет с образами; AVTOSLOT_IMAGE в .env — для форка или своего реестра
  IMAGE=${AVTOSLOT_IMAGE:-$(env_value AVTOSLOT_IMAGE)}
  IMAGE=${IMAGE:-ghcr.io/igorredikultsev-arch/avtoslot}
  case "${1:-}" in
    --build) build=1 ;;
    "") ;;
    *) target=$1 ;;
  esac

  if [[ -n $target ]]; then
    git merge --ff-only -q "$target"
  else
    git pull --ff-only -q
  fi
  local tag prev
  tag=$(git rev-parse HEAD)
  prev=$(env_value AVTOSLOT_TAG)

  if (( build )); then
    tag="local-${tag:0:12}"
    AVTOSLOT_TAG=$tag docker compose -f docker-compose.yml -f docker-compose.build.yml --profile tools build
  else
    local i err ok=0
    for i in 1 2 3; do
      if err=$( { docker pull -q "$IMAGE:migrate-$tag" && docker pull -q "$IMAGE:app-$tag"; } 2>&1 >/dev/null ); then
        ok=1; break
      fi
      if (( i < 3 )); then sleep 10; fi
    done
    if (( ! ok )); then
      echo "Образы для ${tag:0:7} не скачались: проверка на GitHub ещё идёт, упала или ghcr.io недоступен." >&2
      echo "Ответ: $(tail -1 <<<"$err")" >&2
      echo "Сайт работает на прошлой версии." >&2
      return 3
    fi
  fi

  export AVTOSLOT_TAG=$tag

  # Копия базы перед миграциями: откат ниже возвращает прошлую версию сайта, а прошлую базу — только эта копия.
  # Хранятся три последние, восстановление: deploy/restore.sh <файл>
  docker compose up -d --wait db >/dev/null
  mkdir -p deploy/backups
  local pre
  pre="deploy/backups/before-update-$(date +%Y%m%d-%H%M%S).sql.gz"
  if ! { docker compose exec -T db pg_dump -U avtoslot avtoslot | gzip > "$pre"; } || ! gzip -t "$pre"; then
    rm -f "$pre"
    echo "Не получилось сделать копию базы перед обновлением, обновление отменено. Сайт работает на прошлой версии." >&2
    return 1
  fi
  ls -1t deploy/backups/before-update-*.sql.gz | tail -n +4 | xargs -r rm -f

  docker compose run --rm -T migrate </dev/null
  docker compose up -d
  # Caddyfile мог поменяться вместе с кодом: перечитать без остановки
  docker compose exec -T caddy caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile >/dev/null 2>&1 || true

  # Новая версия должна ответить за минуту. Иначе возвращаем прошлую (её образ хранится на сервере)
  if ! site_ok; then
    echo "Новая версия ${tag:0:12} не отвечает. Последние строки журнала сайта:" >&2
    docker compose logs --tail 30 app >&2 || true
    if [[ -n $prev && $prev != "$tag" ]]; then
      echo "Возвращаю прошлую версию ${prev:0:12}" >&2
      AVTOSLOT_TAG=$prev docker compose up -d app
      AVTOSLOT_TAG=$prev site_ok && echo "Прошлая версия работает" >&2
    fi
    return 1
  fi

  # Версию запоминаем только после удачного запуска: ручные docker compose и перезагрузка берут её из .env
  if grep -q '^AVTOSLOT_TAG=' .env; then
    sed -i "s/^AVTOSLOT_TAG=.*/AVTOSLOT_TAG=$tag/" .env
  else
    printf '\n# Версия сайта (коммит), её ставит deploy/update.sh\nAVTOSLOT_TAG=%s\n' "$tag" >> .env
  fi

  # Оставляем образы текущей и прошлой версии, остальные удаляем, чтобы не забивать диск.
  # Заодно убираем то, что осталось от сборки на сервере (старые образы app-app, app-migrate и кеш сборки).
  docker images "$IMAGE" --format '{{.Tag}}' | grep -Ev "^(app|migrate)-(${tag}|${prev:-none})$" \
    | sed "s|^|$IMAGE:|" | xargs -r docker rmi >/dev/null 2>&1 || true
  docker rmi app-app app-migrate >/dev/null 2>&1 || true
  docker image prune -f >/dev/null
  (( build )) || docker builder prune -af >/dev/null 2>&1 || true
  # Ночное расписание могло поменяться вместе с кодом
  ./deploy/schedule.sh || echo "Не получилось обновить ночное расписание (deploy/schedule.sh)" >&2
  echo "Готово: версия ${tag:0:12}. Свободно на диске: $(df -h / | awk 'NR==2 {print $4}')"
}

main "$@"
exit
