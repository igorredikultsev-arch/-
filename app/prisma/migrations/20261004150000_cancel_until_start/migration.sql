-- Отмена клиентом по ссылке до самого визита: предоплаты нет, а лишний час на отмену только освобождает время.
-- Владелец может поставить свой срок в кабинете. Подключённых клиентов ещё нет, у всех стоит прежнее значение по умолчанию.
ALTER TABLE "Business" ALTER COLUMN "cancelHours" SET DEFAULT 0;
UPDATE "Business" SET "cancelHours" = 0 WHERE "cancelHours" = 24;
