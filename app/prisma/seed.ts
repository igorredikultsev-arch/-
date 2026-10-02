// Тестовые данные для разработки: демо-шиномонтаж «Колесо» и администратор.
import "dotenv/config";
import { hash } from "@node-rs/argon2";
import { PrismaClient } from "@prisma/client";
import { DEFAULT_FACTS, DEFAULT_HOURS, TIRE_SERVICES } from "../src/lib/templates";

const db = new PrismaClient();

async function main() {
  await db.business.deleteMany({ where: { slug: { in: ["koleso", "kniga", "asfalt"] } } });
  const themes = [
    { slug: "koleso", theme: "garage" as const, accent: "#ff6a1f", headline: "Шиномонтаж без очереди. Запись за минуту" },
    { slug: "kniga", theme: "book" as const, accent: "#2350d6", headline: "Шиномонтаж и развал без очереди" },
    { slug: "asfalt", theme: "road" as const, accent: "#f2c200", headline: "Переобуем без очереди" },
  ];
  for (const t of themes) {
    await db.business.create({
      data: {
        slug: t.slug,
        name: "Шиномонтаж «Колесо»",
        address: "ул. Примерная, 12",
        addressNote: "Въезд со двора, ворота с вывеской",
        phone: "+73422541873",
        yandexMapsUrl: "https://yandex.ru/maps/",
        twoGisUrl: "https://2gis.ru/perm",
        rating: 4.8,
        reviewsYandex: 98,
        reviews2gis: 28,
        headline: t.headline,
        theme: t.theme,
        accent: t.accent,
        posts: 2,
        facts: DEFAULT_FACTS,
        operatorName: "ИП Шаров Д. А.",
        operatorInn: "590412873316",
        status: t.slug === "koleso" ? "demo" : "trial",
        demoExpiresAt: new Date(Date.now() + 14 * 86400000),
        hours: { create: DEFAULT_HOURS },
        services: { create: TIRE_SERVICES.map((s, i) => ({ ...s, sortOrder: i })) },
        lead: { create: { status: "demo_sent", channel: "Telegram" } },
      },
    });
  }
  const phone = "+79990000001";
  await db.user.upsert({
    where: { phone },
    update: {},
    create: { phone, passwordHash: await hash("admin-dev-password"), role: "admin", name: "Администратор" },
  });
  const kniga = await db.business.findUniqueOrThrow({ where: { slug: "kniga" } });
  await db.user.upsert({
    where: { phone: "+79990000002" },
    update: { businessId: kniga.id },
    create: { phone: "+79990000002", passwordHash: await hash("owner-dev-password"), role: "owner", name: "Дмитрий", businessId: kniga.id },
  });
  console.log("Готово: /s/koleso, /s/kniga, /s/asfalt. Админ +79990000001 / admin-dev-password, владелец «kniga» +79990000002 / owner-dev-password");
}

main().finally(() => db.$disconnect());
