-- Стенд развал-схождения отдельно от постов: число стендов у сервиса, отметка у услуги и у записи
ALTER TABLE "Business" ADD COLUMN "standPosts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Service" ADD COLUMN "onStand" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Booking" ADD COLUMN "onStand" BOOLEAN NOT NULL DEFAULT false;
