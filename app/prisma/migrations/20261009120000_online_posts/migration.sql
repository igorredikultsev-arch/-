-- Пост под онлайн-запись (решение 9 октября): сайт записывает только на onlinePosts постов,
-- остальные работают по живой очереди и звонкам, вносить их в кабинет не обязательно
ALTER TABLE "Business" ADD COLUMN "onlinePosts" INTEGER NOT NULL DEFAULT 1;

-- Подключённые сервисы уже работают со всеми постами под запись: молча им это не меняем, переключают в кабинете
UPDATE "Business" SET "onlinePosts" = "posts" WHERE "status" <> 'demo';
