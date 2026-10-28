-- Услуга за несколькими мастерами («Ромашов или Шарапов»): вместо одного Service.staffId — таблица связей.
-- Service.staffId не удаляем: на него опирается прошлая версия сайта (откат при неудачном обновлении). Удалить следующим выпуском
CREATE TABLE "_ServiceToStaff" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_ServiceToStaff_AB_pkey" PRIMARY KEY ("A","B")
);
CREATE INDEX "_ServiceToStaff_B_index" ON "_ServiceToStaff"("B");
ALTER TABLE "_ServiceToStaff" ADD CONSTRAINT "_ServiceToStaff_A_fkey" FOREIGN KEY ("A") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "_ServiceToStaff" ADD CONSTRAINT "_ServiceToStaff_B_fkey" FOREIGN KEY ("B") REFERENCES "Staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;
INSERT INTO "_ServiceToStaff" ("A", "B") SELECT "id", "staffId" FROM "Service" WHERE "staffId" IS NOT NULL;

-- Закрыть запись на сотрудника (заболел)
ALTER TABLE "Block" ADD COLUMN "staffId" TEXT;
ALTER TABLE "Block" ADD CONSTRAINT "Block_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;
