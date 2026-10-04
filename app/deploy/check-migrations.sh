#!/usr/bin/env bash
# Проверка в CI: новые миграции не должны ломать прошлую версию сайта.
# При неудачном обновлении update.sh возвращает прошлую версию сайта, но не базу. Если миграция удалила или переименовала
# столбец, прошлая версия на новой базе падает. Поэтому разрушающие изменения делаются в два выпуска: сначала код перестаёт
# использовать столбец, следующим выпуском столбец удаляется — и такая миграция помечается строкой «-- destructive-ok».
# Миграции до 20261004170000_logo включительно уже на сервере и не проверяются.
set -euo pipefail
cd "$(dirname "$0")/.."
bad=0
for f in prisma/migrations/*/migration.sql; do
  name=$(basename "$(dirname "$f")")
  [[ $name > 20261004170000_logo ]] || continue
  grep -q -- '-- destructive-ok' "$f" && continue
  if grep -n -i -E 'DROP[[:space:]]+(COLUMN|TABLE)|RENAME[[:space:]]+(COLUMN|TO)|ALTER[[:space:]]+COLUMN[^;]*[[:space:]]TYPE[[:space:]]|SET[[:space:]]+NOT[[:space:]]+NULL|DROP[[:space:]]+VALUE' "$f"; then
    echo "::error file=app/$f::Миграция $name удаляет или меняет то, что использует прошлая версия сайта. Разделите на два выпуска или пометьте «-- destructive-ok»" >&2
    bad=1
  fi
done
exit $bad
