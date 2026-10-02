#!/usr/bin/env bash
# Ежедневная резервная копия базы (раздел 6.3, п. 8 плана).
# Копия хранится локально 14 дней и отправляется в S3-хранилище в России
# (Yandex Object Storage, Selectel, Timeweb S3), если заданы переменные S3_*.
# Запуск из cron на сервере:  15 3 * * *  cd /opt/avtoslot/app && ./deploy/backup.sh >> deploy/backup.log 2>&1
set -euo pipefail
cd "$(dirname "$0")/.."
set -a; . ./.env; set +a

mkdir -p deploy/backups
file="deploy/backups/avtoslot-$(date +%Y%m%d-%H%M).sql.gz"
docker compose exec -T db pg_dump -U avtoslot avtoslot | gzip > "$file"
find deploy/backups -name '*.sql.gz' -mtime +14 -delete
echo "$(date -Is) local backup: $file"

if [[ -n "${S3_BUCKET:-}" ]]; then
  docker run --rm -v "$PWD/deploy/backups:/b:ro" \
    -e AWS_ACCESS_KEY_ID="$S3_ACCESS_KEY" -e AWS_SECRET_ACCESS_KEY="$S3_SECRET_KEY" -e AWS_DEFAULT_REGION="${S3_REGION:-ru-central1}" \
    amazon/aws-cli s3 cp "/b/$(basename "$file")" "s3://$S3_BUCKET/$(basename "$file")" --endpoint-url "$S3_ENDPOINT"
  echo "$(date -Is) uploaded to s3://$S3_BUCKET"
fi
