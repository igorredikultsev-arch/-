-- Три новые темы сайта вместо старых: «Боковина», «План», «Такси».
-- Старые темы переезжают: «Гараж» в «Боковину», «Асфальт» в «План», «Сервисная книжка» в «Такси».
ALTER TYPE "Theme" RENAME TO "Theme_old";
CREATE TYPE "Theme" AS ENUM ('tire', 'plan', 'taxi');
ALTER TABLE "Business" ALTER COLUMN "theme" DROP DEFAULT;
ALTER TABLE "Business" ALTER COLUMN "theme" TYPE "Theme" USING (
  CASE "theme"::text WHEN 'garage' THEN 'tire' WHEN 'road' THEN 'plan' ELSE 'taxi' END
)::"Theme";
ALTER TABLE "Business" ALTER COLUMN "theme" SET DEFAULT 'taxi';
DROP TYPE "Theme_old";

-- Акцент старых тем (оранжевый, синий штамп, жёлтая разметка) меняем на цвет новой темы
UPDATE "Business" SET "accent" = CASE "theme" WHEN 'tire' THEN '#f2c230' WHEN 'plan' THEN '#ffc400' ELSE '#1f9d55' END;
ALTER TABLE "Business" ALTER COLUMN "accent" SET DEFAULT '#1f9d55';

-- Когда владелец сам выбрал стиль в демо
ALTER TABLE "Business" ADD COLUMN "themeChosenAt" TIMESTAMP(3);
