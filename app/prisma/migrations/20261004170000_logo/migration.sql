/*
  Warnings:

  - You are about to drop the column `logoLetter` on the `Business` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Business" DROP COLUMN "logoLetter",
ADD COLUMN     "logoAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "BusinessLogo" (
    "businessId" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "mime" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessLogo_pkey" PRIMARY KEY ("businessId")
);

-- AddForeignKey
ALTER TABLE "BusinessLogo" ADD CONSTRAINT "BusinessLogo_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
