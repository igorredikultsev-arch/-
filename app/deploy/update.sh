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
# остальное — ошибка обновления (сайт остаётся на прошлой версии).
set -euo pipefail

env_value() { sed -n "s/^$1=//p" .env | tr -d "\"'" | tail -1; }

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
  docker compose run --rm -T migrate </dev/null
  docker compose up -d

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
  echo "Готово: версия ${tag:0:12}. Свободно на диске: $(df -h / | awk 'NR==2 {print $4}')"
}

main "$@"
exit
