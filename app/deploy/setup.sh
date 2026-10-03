#!/usr/bin/env bash
# Первая установка на чистый сервер Ubuntu 24.04. Запуск под root:
#   curl -fsSL https://raw.githubusercontent.com/igorredikultsev-arch/-/claude/admiring-davinci-ej5p3n/app/deploy/setup.sh | bash
# Скрипт можно запускать повторно: готовые шаги он пропускает.
set -euo pipefail

REPO="https://github.com/igorredikultsev-arch/-.git"
BRANCH="${BRANCH:-claude/admiring-davinci-ej5p3n}"
DIR="/opt/avtoslot"

# Консоль в панели хостинга иногда подмешивает в ввод служебные коды терминала (и Ctrl+V), вычищаем их
ask() { local v; read -r -p "$1: " v </dev/tty; printf '%s' "$v" | sed $'s/\x1b\[[0-9;?]*[A-Za-z]//g' | tr -d '\000-\037\177' | sed 's/^ *//; s/ *$//'; }
step() { printf '\n\033[1;32m==> %s\033[0m\n' "$1"; }

[[ $EUID -eq 0 ]] || { echo "Запустите под root"; exit 1; }

step "Файл подкачки (чтобы сборке хватило памяти)"
if ! swapon --show | grep -q .; then
  fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
else
  echo "уже есть"
fi

step "Пакеты и Docker"
apt-get update -qq && apt-get install -y -qq git curl openssl cron >/dev/null
command -v docker >/dev/null || curl -fsSL https://get.docker.com | sh

step "Код"
if [[ -d "$DIR/.git" ]]; then
  git -C "$DIR" fetch -q origin "$BRANCH" && git -C "$DIR" checkout -q "$BRANCH" && git -C "$DIR" pull -q
else
  git clone -q -b "$BRANCH" "$REPO" "$DIR"
fi
cd "$DIR/app"

if [[ ! -f .env ]]; then
  step "Настройки"
  DOMAIN=$(ask "Домен (например avtoslot.ru)")
  EMAIL=$(ask "Ваша почта (для сертификатов и в документах)")
  PNAME=$(ask "ФИО полностью (попадёт в согласие и политику)")
  PINN=$(ask "ИНН (Enter, если пока нет)")
  TG=$(ask "Ваш Telegram для связи на главной, без @ (Enter, чтобы пропустить)")
  CAPTCHA_CLIENT=$(ask "SmartCaptcha: ключ клиента (Enter, чтобы пропустить)")
  CAPTCHA_SERVER=$(ask "SmartCaptcha: ключ сервера (Enter, чтобы пропустить)")
  cat > .env <<EOF
ROOT_DOMAIN="$DOMAIN"
APP_URL="https://$DOMAIN"
SMARTCAPTCHA_CLIENT_KEY="$CAPTCHA_CLIENT"
SMARTCAPTCHA_SERVER_KEY="$CAPTCHA_SERVER"
CONTACT_TELEGRAM="$TG"
EXAMPLE_SLUG=""
CRON_SECRET="$(openssl rand -hex 24)"
PROCESSOR_NAME="$PNAME, самозанятый"
PROCESSOR_INN="$PINN"
PROCESSOR_EMAIL="$EMAIL"
POSTGRES_PASSWORD="$(openssl rand -hex 24)"
ACME_EMAIL="$EMAIL"
S3_BUCKET=""
S3_ENDPOINT="https://storage.yandexcloud.net"
S3_REGION="ru-central1"
S3_ACCESS_KEY=""
S3_SECRET_KEY=""
EOF
  chmod 600 .env
fi
set -a; . ./.env; set +a

step "Проверка DNS"
IP=$(curl -fsS4 https://ifconfig.me || true)
DNS_IP=$(getent ahostsv4 "$ROOT_DOMAIN" | awk 'NR==1{print $1}' || true)
if [[ -n "$IP" && "$IP" != "$DNS_IP" ]]; then
  echo "ВНИМАНИЕ: $ROOT_DOMAIN указывает на '${DNS_IP:-ничего}', а IP сервера $IP."
  echo "Сайт запустится, но сертификат появится только после исправления A-записей."
else
  echo "ок: $ROOT_DOMAIN -> $IP"
fi

step "Сборка и запуск (первый раз 5-10 минут)"
docker compose up -d db
docker compose --profile tools build
docker compose run --rm -T migrate </dev/null
docker compose up -d

step "Расписание: резервные копии и очистка"
chmod +x deploy/backup.sh
( crontab -l 2>/dev/null | grep -v '# avtoslot$' || true
  echo "15 3 * * * cd $DIR/app && ./deploy/backup.sh >> deploy/backup.log 2>&1 # avtoslot"
  echo "30 3 * * * curl -s -X POST -H 'Authorization: Bearer $CRON_SECRET' https://$ROOT_DOMAIN/api/cron/cleanup >/dev/null # avtoslot"
) | crontab -
chmod +x deploy/autoupdate.sh
./deploy/autoupdate.sh install

if [[ ! -f .admin-created ]]; then
  step "Вход в админку"
  PHONE=$(ask "Ваш телефон для входа (+79...)")
  PASS=$(openssl rand -base64 12 | tr -d '/+=')
  docker compose run --rm -T migrate npx tsx scripts/create-admin.ts "$PHONE" "$PASS" </dev/null
  touch .admin-created
  printf '\n\033[1;33mПароль админки: %s\033[0m  (сохраните его, больше он не покажется)\n' "$PASS"
fi

step "Готово"
echo "Админка: https://$ROOT_DOMAIN/login"
echo "Обновления ставятся сами раз в 5 минут после пуша в ветку $BRANCH (журнал: $DIR/app/deploy/update.log)."
echo "Обновить вручную: $DIR/app/deploy/update.sh"
