-- Календарь как Google: записи на весь день (CalendarNote) и UID событий при переносе из Google Календаря (только добавляет)

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "externalId" TEXT;

-- CreateTable
CREATE TABLE "CalendarNote" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "staffId" TEXT,
    "title" TEXT NOT NULL,
    "startDate" TEXT NOT NULL,
    "endDate" TEXT NOT NULL,
    "externalId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CalendarNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CalendarNote_businessId_startDate_idx" ON "CalendarNote"("businessId", "startDate");

-- CreateIndex
CREATE INDEX "CalendarNote_staffId_idx" ON "CalendarNote"("staffId");

-- CreateIndex
CREATE UNIQUE INDEX "CalendarNote_businessId_externalId_key" ON "CalendarNote"("businessId", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "Booking_businessId_externalId_key" ON "Booking"("businessId", "externalId");

-- AddForeignKey
ALTER TABLE "CalendarNote" ADD CONSTRAINT "CalendarNote_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarNote" ADD CONSTRAINT "CalendarNote_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

