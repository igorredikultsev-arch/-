-- Форма записи: госномер и комментарий обязательны по желанию сервиса (только добавляет)
ALTER TABLE "Business" ADD COLUMN "askPlate" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Business" ADD COLUMN "requireComment" BOOLEAN NOT NULL DEFAULT false;
