-- Только добавляет индексы: удаление услуги и счётчик оплат в кабинете больше не просматривают всю таблицу
-- CreateIndex
CREATE INDEX "Booking_serviceId_idx" ON "Booking"("serviceId");

-- CreateIndex
CREATE INDEX "Payment_businessId_idx" ON "Payment"("businessId");
