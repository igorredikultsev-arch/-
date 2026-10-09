-- Отметки об открытии демо владельцем (только добавляет таблицу)
CREATE TABLE "DemoView" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "device" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DemoView_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DemoView_businessId_at_idx" ON "DemoView"("businessId", "at");

ALTER TABLE "DemoView" ADD CONSTRAINT "DemoView_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
