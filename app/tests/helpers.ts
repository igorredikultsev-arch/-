import { db } from "@/lib/db";

export async function resetDb() {
  await db.$executeRawUnsafe(
    'TRUNCATE "Booking","Block","Service","WorkingHours","DayException","Session","User","Lead","Payment","RateLimit","AuditLog","Business" CASCADE',
  );
}

export async function makeBusiness(over: { posts?: number; slug?: string } = {}) {
  return db.business.create({
    data: {
      slug: over.slug ?? "koleso",
      name: "Шиномонтаж «Колесо»",
      address: "Пермь, ул. Примерная, 12",
      phone: "+73422541873",
      posts: over.posts ?? 1,
      minLeadMin: 0,
      horizonDays: 30,
      hours: { create: [1, 2, 3, 4, 5, 6, 7].map((weekday) => ({ weekday, openMin: 540, closeMin: 1200 })) },
      services: { create: [{ category: "Шиномонтаж", name: "Смена колёс R13-R16", priceFrom: 1600, durationMin: 40 }] },
    },
    include: { services: true },
  });
}
