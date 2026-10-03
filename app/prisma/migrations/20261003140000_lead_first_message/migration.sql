-- Первое сообщение владельцу из таблицы лидов (импорт демо), ссылка на демо уже подставлена
ALTER TABLE "Lead" ADD COLUMN "firstMessage" TEXT;
