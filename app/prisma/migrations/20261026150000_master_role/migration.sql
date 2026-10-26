-- Вход мастера: календарь только на просмотр, открывается на его посту
ALTER TYPE "Role" ADD VALUE 'master';
ALTER TABLE "User" ADD COLUMN "staffId" TEXT;
ALTER TABLE "User" ADD CONSTRAINT "User_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
