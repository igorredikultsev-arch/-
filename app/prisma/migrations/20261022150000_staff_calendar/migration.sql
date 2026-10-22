-- Календарь в кабинете: сотрудники (колонки со своим цветом), к кому стоит запись и кто её внёс
CREATE TABLE "Staff" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "onStand" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "Staff_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Staff_businessId_sortOrder_idx" ON "Staff"("businessId", "sortOrder");
ALTER TABLE "Staff" ADD CONSTRAINT "Staff_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Booking" ADD COLUMN "staffId" TEXT;
ALTER TABLE "Booking" ADD COLUMN "createdById" TEXT;
CREATE INDEX "Booking_staffId_idx" ON "Booking"("staffId");
CREATE INDEX "Booking_createdById_idx" ON "Booking"("createdById");
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
