-- Услуга закреплена за постом (шиномонтаж только на «Пост 1»); пост удалён — услуга снова на любом
ALTER TABLE "Service" ADD COLUMN "staffId" TEXT;
ALTER TABLE "Service" ADD CONSTRAINT "Service_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
