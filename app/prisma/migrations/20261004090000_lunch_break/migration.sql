-- Обед в часах работы: перерыв по дням недели, в это время запись с сайта закрыта
ALTER TABLE "WorkingHours" ADD COLUMN "breakFromMin" INTEGER;
ALTER TABLE "WorkingHours" ADD COLUMN "breakToMin" INTEGER;
