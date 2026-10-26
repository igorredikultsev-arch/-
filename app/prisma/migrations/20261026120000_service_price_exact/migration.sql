-- Цена точная: на сайте без «от»
ALTER TABLE "Service" ADD COLUMN "priceExact" BOOLEAN NOT NULL DEFAULT false;
