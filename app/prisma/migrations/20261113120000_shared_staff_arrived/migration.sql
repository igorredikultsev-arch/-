-- Общий календарь: сайт и автоподбор поста туда записи не ставят
ALTER TABLE "Staff" ADD COLUMN "shared" BOOLEAN NOT NULL DEFAULT false;
-- «Клиент у нас»: когда клиент приехал
ALTER TABLE "Booking" ADD COLUMN "arrivedAt" TIMESTAMP(3);
