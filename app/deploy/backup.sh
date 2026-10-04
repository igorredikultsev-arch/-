#!/usr/bin/env bash
# Ежедневная резервная копия базы (раздел 6.3, п. 8 плана). Запускается ночью из cron (deploy/schedule.sh).
# Копия хранится на сервере 14 дней и отправляется в S3-хранилище в России у другой компании
# (Yandex Object Storage, Selectel), если заданы переменные S3_*: пропадёт сервер — копии останутся.
# Срок хранения в хранилище (30 дней, как в оферте) задаётся правилом жизненного цикла в самом хранилище.
# Если задан HEALTHCHECK_BACKUP_URL, об успехе и ошибке узнаёт мониторинг (и пишет вам).
set -euo pipefail
cd "$(dirname "$0")/.."
set -a; . ./.env; set +a

ping() { [[ -n "${HEALTHCHECK_BACKUP_URL:-}" ]] && curl -fsS -m 10 --retry 3 -o /dev/null "$HEALTHCHECK_BACKUP_URL$1" || true; }
fail() { echo "$(date -Is) ОШИБКА: $1" >&2; ping /fail; exit 1; }

mkdir -p deploy/backups
file="deploy/backups/avtoslot-$(date +%Y%m%d-%H%M).sql.gz"
if ! { docker compose exec -T db pg_dump -U avtoslot avtoslot | gzip > "$file"; } || ! gzip -t "$file"; then
  rm -f "$file"
  fail "копия базы не сделалась"
fi
find deploy/backups -name '*.sql.gz' -mtime +14 -delete
echo "$(date -Is) копия на сервере: $file ($(du -h "$file" | cut -f1))"

if [[ -n "${S3_BUCKET:-}" ]]; then
  # Новые версии aws-cli по умолчанию считают контрольные суммы, которые не все российские хранилища принимают
  docker run --rm -v "$PWD/deploy/backups:/b:ro" \
    -e AWS_ACCESS_KEY_ID="$S3_ACCESS_KEY" -e AWS_SECRET_ACCESS_KEY="$S3_SECRET_KEY" -e AWS_DEFAULT_REGION="${S3_REGION:-ru-central1}" \
    -e AWS_REQUEST_CHECKSUM_CALCULATION=when_required -e AWS_RESPONSE_CHECKSUM_VALIDATION=when_required \
    amazon/aws-cli s3 cp --only-show-errors "/b/$(basename "$file")" "s3://$S3_BUCKET/$(basename "$file")" --endpoint-url "$S3_ENDPOINT" \
    || fail "копия не отправилась в хранилище $S3_BUCKET"
  echo "$(date -Is) отправлена в хранилище s3://$S3_BUCKET"
else
  echo "$(date -Is) хранилище не настроено (S3_BUCKET пуст): копия только на этом сервере"
fi
ping ""
