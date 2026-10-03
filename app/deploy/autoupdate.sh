#!/usr/bin/env bash
# Автообновление сайта. Включить один раз:  /opt/avtoslot/app/deploy/autoupdate.sh install
# Дальше cron раз в 5 минут смотрит ветку на GitHub. Появился новый коммит и проверка на GitHub прошла
# (она же собирает и публикует образы) — запускается update.sh: скачать образы, миграции, перезапуск.
# Если проверка упала или обновление не удалось, этот коммит пропускается до следующего.
# Если образы не скачались (GitHub недоступен), попытка повторяется через 5 минут.
# Журнал: /opt/avtoslot/app/deploy/update.log
set -euo pipefail

# Всё в функции: update.sh ниже может поменять этот файл, а bash читает скрипт по ходу выполнения
main() {
  cd "$(dirname "$0")/.."
  local log=deploy/update.log state=deploy/.deployed failed=deploy/.failed seen=deploy/.seen
  local REPO_API="https://api.github.com/repos/igorredikultsev-arch/-"

  if [[ "${1:-}" == "install" ]]; then
    git rev-parse HEAD > "$state"
    ( crontab -l 2>/dev/null | grep -v avtoslot-autoupdate || true
      echo "*/5 * * * * $PWD/deploy/autoupdate.sh >> $PWD/$log 2>&1 # avtoslot-autoupdate"
    ) | crontab -
    echo "Автообновление включено: раз в 5 минут. Журнал: $PWD/$log"
    echo "Выключить: crontab -l | grep -v avtoslot-autoupdate | crontab -"
    return
  fi

  exec 9>/tmp/avtoslot-update.lock
  flock -n 9 || return 0 # прошлое обновление ещё идёт

  # Журнал не даём разрастись
  [[ -f $log && $(stat -c %s "$log") -gt 5000000 ]] && tail -c 1000000 "$log" > "$log.tmp" && mv "$log.tmp" "$log"

  local branch target
  branch=$(git rev-parse --abbrev-ref HEAD)
  git fetch -q origin "$branch"
  target=$(git rev-parse FETCH_HEAD)
  [[ "$target" == "$(cat "$state" 2>/dev/null)" || "$target" == "$(cat "$failed" 2>/dev/null)" ]] && return 0
  # Новый коммит берём со второго захода: за 5 минут GitHub успевает завести по нему проверку
  if [[ "$target" != "$(cat "$seen" 2>/dev/null)" ]]; then echo "$target" > "$seen"; return 0; fi

  # Ждём проверку на GitHub (тесты и сборка). Нет проверок — не ждём.
  local checks
  if checks=$(curl -fsS -m 20 -H "Accept: application/vnd.github+json" "$REPO_API/commits/$target/check-runs" 2>/dev/null); then
    if grep -Eq '"status": *"(queued|in_progress|waiting|pending)"' <<<"$checks"; then return 0; fi
    if grep -Eq '"conclusion": *"(failure|timed_out|cancelled)"' <<<"$checks"; then
      echo "$(date '+%F %T') ${target:0:7}: проверка на GitHub не прошла, пропускаю"
      echo "$target" > "$failed"
      return 0
    fi
  fi

  # Образы не скачались — повторяем позже, но пишем в журнал только первый раз
  local waiting=deploy/.waiting code=0
  [[ "$target" == "$(cat "$waiting" 2>/dev/null)" ]] || echo "$(date '+%F %T') обновляю до ${target:0:7}"
  ./deploy/update.sh "$target" || code=$?
  if (( code == 0 )); then
    echo "$target" > "$state"
    rm -f "$waiting"
    echo "$(date '+%F %T') готово"
  elif (( code == 3 )); then
    [[ "$target" == "$(cat "$waiting" 2>/dev/null)" ]] || echo "$(date '+%F %T') ${target:0:7}: образы не скачались, повторю через 5 минут"
    echo "$target" > "$waiting"
  else
    echo "$target" > "$failed"
    rm -f "$waiting"
    echo "$(date '+%F %T') ${target:0:7}: обновление не удалось, сайт работает на прошлой версии"
  fi
}

main "$@"
exit
