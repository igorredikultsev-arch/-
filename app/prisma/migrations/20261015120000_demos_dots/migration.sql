-- Демо открываются в «Частицах» (15 октября 2026). Демо, где владелец стиль сам не выбирал и стоит прежний стиль
-- по умолчанию «Чёрно-белый», переводим в «Частицы». Выбор владельца, другие стили и работающие сервисы не трогаем;
-- цвет меняем, только если это был цвет «Чёрно-белого» по умолчанию.
UPDATE "Business"
SET "theme" = 'dots', "accent" = CASE WHEN lower("accent") = '#1f9d55' THEN '#7c5cff' ELSE "accent" END
WHERE "status" = 'demo' AND "theme" = 'taxi' AND "themeChosenAt" IS NULL;

ALTER TABLE "Business" ALTER COLUMN "theme" SET DEFAULT 'dots';
ALTER TABLE "Business" ALTER COLUMN "accent" SET DEFAULT '#7c5cff';
