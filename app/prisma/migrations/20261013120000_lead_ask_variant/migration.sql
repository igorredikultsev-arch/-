-- Номер варианта первого сообщения-вопроса: в админке видно, какой текст сколько ответов дал
ALTER TABLE "Lead" ADD COLUMN "askVariant" INTEGER;
