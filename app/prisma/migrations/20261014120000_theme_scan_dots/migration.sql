-- Новые стили сайта «Сканер» и «Частицы». Только добавляет значения, прошлая версия сайта их просто не видит.
ALTER TYPE "Theme" ADD VALUE IF NOT EXISTS 'scan';
ALTER TYPE "Theme" ADD VALUE IF NOT EXISTS 'dots';

-- Стиль «Тёмный» (tire) стал «Колесом» с синим суппортом. Его прежний жёлтый цвет по умолчанию меняем на новый;
-- цвет, который сервису поставили вручную, не трогаем.
UPDATE "Business" SET "accent" = '#2f7bff' WHERE "theme" = 'tire' AND lower("accent") = '#f2c230';
