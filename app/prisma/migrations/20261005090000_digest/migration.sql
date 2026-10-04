-- Утренняя сводка владельцу
ALTER TABLE "Business" ADD COLUMN "digestEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Business" ADD COLUMN "digestSentOn" TEXT;
