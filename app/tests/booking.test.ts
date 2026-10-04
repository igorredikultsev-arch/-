import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { BookingError, cancelByClient, createOwnerBooking, createSiteBooking, getDaySlots, businessForSlotsSelect } from "@/lib/booking";
import { db } from "@/lib/db";
import { localToUtc } from "@/lib/time";
import { makeBusiness, resetDb } from "./helpers";

const TZ = "Asia/Yekaterinburg";
const DATE = "2026-10-10";
const NOW = localToUtc("2026-10-05", 600, TZ);

const siteInput = (businessId: string, serviceId: string, n: number) => ({
  businessId,
  serviceId,
  date: DATE,
  time: "10:00",
  clientName: `Клиент ${n}`,
  clientPhone: `+7999000${String(n).padStart(4, "0")}`,
  car: "Kia Rio",
  nowMs: NOW,
});

beforeEach(resetDb);
afterAll(() => db.$disconnect());

describe("createSiteBooking: защита от двойной записи", () => {
  it("1 пост, 20 одновременных запросов на одно окно — записывается ровно один", async () => {
    const biz = await makeBusiness({ posts: 1 });
    const results = await Promise.allSettled(
      Array.from({ length: 20 }, (_, i) => createSiteBooking(siteInput(biz.id, biz.services[0].id, i))),
    );
    const ok = results.filter((r) => r.status === "fulfilled");
    const taken = results.filter((r) => r.status === "rejected" && (r.reason as BookingError).code === "slot_taken");
    expect(ok).toHaveLength(1);
    expect(taken).toHaveLength(19);
    expect(await db.booking.count()).toBe(1);
  });

  it("2 поста — записываются ровно двое", async () => {
    const biz = await makeBusiness({ posts: 2 });
    const results = await Promise.allSettled(
      Array.from({ length: 10 }, (_, i) => createSiteBooking(siteInput(biz.id, biz.services[0].id, i))),
    );
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(2);
    expect(await db.booking.count()).toBe(2);
  });

  it("время вне сетки и вне часов работы отклоняется", async () => {
    const biz = await makeBusiness();
    await expect(createSiteBooking({ ...siteInput(biz.id, biz.services[0].id, 1), time: "10:10" })).rejects.toMatchObject({
      code: "bad_slot",
    });
    await expect(createSiteBooking({ ...siteInput(biz.id, biz.services[0].id, 1), time: "19:50" })).rejects.toMatchObject({
      code: "bad_slot",
    });
  });

  it("сохраняет согласие на обработку ПДн", async () => {
    const biz = await makeBusiness();
    const b = await createSiteBooking({ ...siteInput(biz.id, biz.services[0].id, 1), consentIp: "10.0.0.1" });
    expect(b.consentVersion).toBeTruthy();
    expect(b.consentAt?.getTime()).toBe(NOW);
    expect(b.consentIp).toBe("10.0.0.1");
    expect(b.cancelToken.length).toBeGreaterThan(20);
  });
});

describe("записи владельца и закрытое время", () => {
  it("запись по телефону занимает окно на сайте", async () => {
    const biz = await makeBusiness();
    await createOwnerBooking({ businessId: biz.id, serviceId: biz.services[0].id, date: DATE, startMin: 600 });
    const full = await db.business.findUniqueOrThrow({ where: { id: biz.id }, select: businessForSlotsSelect });
    const slots = await getDaySlots(full, DATE, 40, NOW);
    expect(slots.find((s) => s.time === "10:00")?.free).toBe(false);
    expect(slots.find((s) => s.time === "11:00")?.free).toBe(true);
  });

  it("при занятых постах владелец получает предупреждение, а с подтверждением записывает", async () => {
    const biz = await makeBusiness();
    const args = { businessId: biz.id, serviceId: biz.services[0].id, date: DATE, startMin: 600 };
    await createOwnerBooking(args);
    const second = await createOwnerBooking(args);
    expect(second.booking).toBeNull();
    expect(second.warning).toMatchObject({ load: 1, posts: 1 });
    const forced = await createOwnerBooking({ ...args, force: true });
    expect(forced.booking).not.toBeNull();
    expect(await db.booking.count()).toBe(2);
  });

  it("закрытое время (обед) недоступно для записи с сайта", async () => {
    const biz = await makeBusiness();
    await db.block.create({
      data: { businessId: biz.id, startAt: new Date(localToUtc(DATE, 780, TZ)), endAt: new Date(localToUtc(DATE, 840, TZ)), reason: "Обед" },
    });
    await expect(createSiteBooking({ ...siteInput(biz.id, biz.services[0].id, 1), time: "13:00" })).rejects.toMatchObject({
      code: "slot_taken",
    });
  });
});

describe("отмена клиентом", () => {
  it("срок владельца (24 часа) соблюдается, после отмены окно снова свободно", async () => {
    const biz = await makeBusiness();
    await db.business.update({ where: { id: biz.id }, data: { cancelHours: 24 } });
    const b = await createSiteBooking(siteInput(biz.id, biz.services[0].id, 1));
    const tooLate = b.startAt.getTime() - 23 * 3600000;
    await expect(cancelByClient(b.cancelToken, tooLate)).rejects.toMatchObject({ code: "too_late" });
    await cancelByClient(b.cancelToken, NOW);
    await expect(cancelByClient(b.cancelToken, NOW)).rejects.toMatchObject({ code: "already_cancelled" });
    const again = await createSiteBooking(siteInput(biz.id, biz.services[0].id, 2));
    expect(again.id).not.toBe(b.id);
  });

  it("по умолчанию — до самого визита, после начала уже нельзя", async () => {
    const biz = await makeBusiness();
    const b = await createSiteBooking(siteInput(biz.id, biz.services[0].id, 1));
    await expect(cancelByClient(b.cancelToken, b.startAt.getTime() + 60000)).rejects.toMatchObject({ code: "too_late" });
    await cancelByClient(b.cancelToken, b.startAt.getTime() - 5 * 60000);
  });
});

import { runCleanup } from "@/lib/cleanup";

describe("runCleanup", () => {
  it("отправляет просроченные демо в архив с карточкой лида и обезличивает старые записи", async () => {
    const old = await makeBusiness({ slug: "old-demo" });
    await db.business.update({
      where: { id: old.id },
      data: { status: "demo", demoExpiresAt: new Date(Date.now() - 1000), lead: { create: { status: "demo_sent", notes: "ответит после праздников" } } },
    });
    const live = await makeBusiness({ slug: "live" });
    await db.business.update({ where: { id: live.id }, data: { status: "active" } });
    await db.booking.create({
      data: {
        businessId: live.id, serviceName: "x", startAt: new Date("2020-01-01T05:00:00Z"), endAt: new Date("2020-01-01T06:00:00Z"),
        source: "site", clientName: "Пётр", clientPhone: "+79990001122", cancelToken: "t-old",
      },
    });
    const r = await runCleanup();
    expect(r.demosArchived).toBe(1);
    expect(r.bookingsAnonymized).toBe(1);
    const b = await db.booking.findUniqueOrThrow({ where: { cancelToken: "t-old" } });
    expect(b.clientName).toBeNull();
    expect(b.clientPhone).toBeNull();
    expect((await db.business.findUniqueOrThrow({ where: { id: old.id } })).status).toBe("archived");
    expect((await db.lead.findUniqueOrThrow({ where: { businessId: old.id } })).notes).toBe("ответит после праздников");
  });
});
