-- Услуга на главном экране сайта: кнопка сразу к выбору времени
ALTER TABLE "Service" ADD COLUMN "featured" BOOLEAN NOT NULL DEFAULT false;
