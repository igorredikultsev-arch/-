-- Только добавляет столбец: дата приостановки сайта для напоминания о 60 днях (оферта, п. 4.2 и 7.7)
-- AlterTable
ALTER TABLE "Business" ADD COLUMN "suspendedAt" TIMESTAMP(3);

-- Уже приостановленные сайты и бывшие клиенты в архиве (были оплаты). Точной даты нет: берём раннюю из возможных —
-- автоприостановка через 7 дней после конца оплаты или последнее изменение сервиса (оно не раньше приостановки).
-- Ранняя дата значит, что напоминание об удалении данных придёт не позже срока
UPDATE "Business" b SET "suspendedAt" = LEAST(b."paidUntil" + INTERVAL '7 days', b."updatedAt")
WHERE b."status" = 'suspended'
   OR (b."status" = 'archived' AND EXISTS (SELECT 1 FROM "Payment" p WHERE p."businessId" = b."id"));
