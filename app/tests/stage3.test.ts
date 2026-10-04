// Этап 3: неявки, приостановка при неоплате, уведомления владельцу, черновик для Роскомнадзора.
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const sent: { endpoint: string; payload: string }[] = [];
vi.mock("web-push", () => ({
  default: {
    generateVAPIDKeys: () => ({ publicKey: "BPublicKeyForTests", privateKey: "privateKeyForTests" }),
    sendNotification: vi.fn(async (sub: { endpoint: string }, payload: string) => {
      if (sub.endpoint.includes("gone")) throw Object.assign(new Error("Gone"), { statusCode: 410 });
      sent.push({ endpoint: sub.endpoint, payload });
    }),
  },
}));

import { createSiteBooking } from "@/lib/booking";
import { runCleanup } from "@/lib/cleanup";
import { db } from "@/lib/db";
import { processor } from "@/lib/legal";
import { newBookingMessage, notifyBusiness, vapidKeys } from "@/lib/push";
import { rknDraft } from "@/lib/rkn";
import { localToUtc } from "@/lib/time";
import { makeBusiness, resetDb } from "./helpers";

const TZ = "Asia/Yekaterinburg";
const NOW = localToUtc("2026-10-05", 600, TZ);
const DAY = 86400000;

beforeEach(async () => {
  await resetDb();
  sent.length = 0;
});
afterAll(() => db.$disconnect());

describe("неявки", () => {
  const book = (businessId: string, serviceId: string, date: string, time: string, nowMs = NOW) =>
    createSiteBooking({ businessId, serviceId, date, time, clientName: "Иван", clientPhone: "+79990001111", car: "Kia Rio", nowMs, maxActivePerPhone: 1 });

  it("после двух неявок за год онлайн-запись с номера закрыта, после одной — нет", async () => {
    const biz = await makeBusiness();
    const sid = biz.services[0].id;
    const past = async (date: string) => {
      const b = await book(biz.id, sid, date, "10:00", localToUtc(date, 0, TZ));
      await db.booking.update({ where: { id: b.id }, data: { status: "no_show" } });
    };
    await past("2026-09-01");
    await book(biz.id, sid, "2026-10-10", "10:00").then((b) => db.booking.delete({ where: { id: b.id } }));
    await past("2026-09-15");
    await expect(book(biz.id, sid, "2026-10-10", "11:00")).rejects.toMatchObject({ code: "no_shows" });
  });
});

describe("неоплата", () => {
  it("через 7 дней после конца оплаченного срока сайт приостанавливается, раньше — нет", async () => {
    const now = new Date(NOW);
    const late = await makeBusiness({ slug: "late" });
    await db.business.update({ where: { id: late.id }, data: { status: "active", paidUntil: new Date(NOW - 8 * DAY) } });
    const grace = await makeBusiness({ slug: "grace" });
    await db.business.update({ where: { id: grace.id }, data: { status: "active", paidUntil: new Date(NOW - 6 * DAY) } });
    const r = await runCleanup(now);
    expect(r.suspendedUnpaid).toBe(1);
    expect((await db.business.findUniqueOrThrow({ where: { id: late.id } })).status).toBe("suspended");
    expect((await db.business.findUniqueOrThrow({ where: { id: grace.id } })).status).toBe("active");
  });
});

describe("уведомления владельцу", () => {
  it("ключи создаются один раз и хранятся в базе", async () => {
    await db.appSetting.deleteMany({ where: { key: "vapid" } });
    const a = await vapidKeys();
    expect(a.publicKey).toBeTruthy();
    expect((await db.appSetting.findUniqueOrThrow({ where: { key: "vapid" } })).value).toContain(a.publicKey);
  });

  it("уходят на все телефоны сервиса без имени и телефона клиента, отписавшиеся удаляются", async () => {
    const biz = await makeBusiness();
    const user = await db.user.create({ data: { phone: "+79990002222", passwordHash: "x", businessId: biz.id } });
    for (const endpoint of ["https://push.example/a", "https://push.example/gone"]) {
      await db.pushSubscription.create({ data: { endpoint, p256dh: "p256dh-key-123", auth: "auth-key-1", userId: user.id, businessId: biz.id } });
    }
    const b = await createSiteBooking({ businessId: biz.id, serviceId: biz.services[0].id, date: "2026-10-10", time: "10:00", clientName: "Иван Петров", clientPhone: "+79990003333", car: "Kia Rio", nowMs: NOW });
    const r = await notifyBusiness(biz.id, newBookingMessage(b, TZ));
    expect(r).toEqual({ sent: 1, removed: 1 });
    expect(sent[0].payload).toContain("Новая запись: сб, 10 октября, 10:00");
    expect(sent[0].payload).not.toMatch(/Иван|9990003333|Kia/);
    expect(await db.pushSubscription.count({ where: { businessId: biz.id } })).toBe(1);
  });
});

describe("черновик уведомления в Роскомнадзор", () => {
  it("подставляет оператора, обработчика и место базы", () => {
    process.env.DB_LOCATION = "Россия, г. Москва, Timeweb Cloud";
    const text = rknDraft(
      { name: "Шиномонтаж «Колесо»", operatorName: "ИП Иванов Иван Иванович", operatorInn: "590412873316", address: "ул. Ленина, 1", city: "Пермь", phone: "+73422000000" },
      processor(),
      "5 октября 2026",
    );
    expect(text).toContain("ИП Иванов Иван Иванович, ИНН 590412873316");
    expect(text).toContain("Россия, г. Москва, Timeweb Cloud");
    expect(text).toContain("Трансграничная передача: не осуществляется");
    delete process.env.DB_LOCATION;
  });
});
