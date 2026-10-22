// Стенд развал-схождения (22 октября): отдельно от постов, по одной машине на стенд.
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { businessForSlotsSelect, createOwnerBooking, createSiteBooking, getDaySlots } from "@/lib/booking";
import { db } from "@/lib/db";
import { localToUtc } from "@/lib/time";
import { makeBusiness, resetDb } from "./helpers";

const TZ = "Asia/Yekaterinburg";
const DATE = "2026-10-10";
const NOW = localToUtc("2026-10-05", 600, TZ);
const site = (businessId: string, serviceId: string, n: number) => ({
  businessId, serviceId, date: DATE, time: "10:00", clientName: `Клиент ${n}`, clientPhone: `+7999100${String(n).padStart(4, "0")}`, car: "Kia Rio", nowMs: NOW,
});

beforeEach(resetDb);
afterAll(() => db.$disconnect());

async function withStand() {
  const biz = await makeBusiness({ posts: 5, onlinePosts: 5 });
  await db.business.update({ where: { id: biz.id }, data: { standPosts: 1 } });
  const align = await db.service.create({ data: { businessId: biz.id, category: "Развал-схождение", name: "Развал-схождение 2 оси", priceFrom: 2500, durationMin: 60, onStand: true } });
  return { biz, tire: biz.services[0], align };
}

describe("стенд развал-схождения", () => {
  it("5 постов и 1 стенд: на развал в одно время с сайта записывается только одна машина", async () => {
    const { biz, align } = await withStand();
    const results = await Promise.allSettled(Array.from({ length: 4 }, (_, i) => createSiteBooking(site(biz.id, align.id, i))));
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const saved = await db.booking.findFirstOrThrow({ where: { businessId: biz.id } });
    expect(saved.onStand).toBe(true);
  });

  it("развал не занимает посты: шиномонтаж на это время всё ещё на 5 машин", async () => {
    const { biz, tire, align } = await withStand();
    await createSiteBooking(site(biz.id, align.id, 1));
    const results = await Promise.allSettled(Array.from({ length: 7 }, (_, i) => createSiteBooking(site(biz.id, tire.id, 10 + i))));
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(5);
    const b = await db.business.findUniqueOrThrow({ where: { id: biz.id }, select: businessForSlotsSelect });
    expect((await getDaySlots(b, DATE, tire, NOW)).find((s) => s.time === "10:00")!.free).toBe(false);
    expect((await getDaySlots(b, DATE, align, NOW)).find((s) => s.time === "10:00")!.free).toBe(false);
    expect((await getDaySlots(b, DATE, align, NOW)).find((s) => s.time === "11:00")!.free).toBe(true);
  });

  it("владелец записывает на занятый стенд только после подтверждения, и предупреждение про стенд", async () => {
    const { biz, align } = await withStand();
    await createSiteBooking(site(biz.id, align.id, 1));
    const first = await createOwnerBooking({ businessId: biz.id, serviceId: align.id, date: DATE, startMin: 600 });
    expect(first.booking).toBeNull();
    expect(first.warning).toMatchObject({ stand: true, load: 1, posts: 1 });
    const forced = await createOwnerBooking({ businessId: biz.id, serviceId: align.id, date: DATE, startMin: 600, force: true });
    expect(forced.booking?.onStand).toBe(true);
  });
});

describe("своя запись текстом, без услуги", () => {
  it("занимает пост на выбранное время, а с отметкой «на стенде» — стенд", async () => {
    const { biz, tire, align } = await withStand();
    const own = await createOwnerBooking({ businessId: biz.id, custom: { title: "Колодки и ходовая, Андрей", durationMin: 120 }, date: DATE, startMin: 600 });
    expect(own.booking).toMatchObject({ serviceId: null, serviceName: "Колодки и ходовая, Андрей", priceFrom: null, onStand: false, source: "owner" });
    expect(own.booking!.endAt.getTime() - own.booking!.startAt.getTime()).toBe(120 * 60000);
    const onStand = await createOwnerBooking({ businessId: biz.id, custom: { title: "Развал, Сергей", durationMin: 60, onStand: true }, date: DATE, startMin: 600 });
    expect(onStand.booking?.onStand).toBe(true);
    const b = await db.business.findUniqueOrThrow({ where: { id: biz.id }, select: businessForSlotsSelect });
    expect((await getDaySlots(b, DATE, align, NOW)).find((s) => s.time === "10:00")!.free).toBe(false);
    // Пост занят своей записью: под шиномонтаж на 10:00 остаётся 4 из 5
    const left = await Promise.allSettled(Array.from({ length: 6 }, (_, i) => createSiteBooking(site(biz.id, tire.id, 30 + i))));
    expect(left.filter((r) => r.status === "fulfilled")).toHaveLength(4);
  });
});
