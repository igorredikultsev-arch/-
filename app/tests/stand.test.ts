// Стенд развал-схождения (22 октября): отдельно от постов, по одной машине на стенд.
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { businessForSlotsSelect, createOwnerBooking, createSiteBooking, getDaySlots } from "@/lib/booking";
import { db } from "@/lib/db";
import { ensureStaff } from "@/lib/staff";
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

describe("услуга, закреплённая за постом (шиномонтаж только на «Пост 1»)", () => {
  it("с сайта на 10:00 записывается одна машина и встаёт на этот пост; другие услуги идут на остальные посты", async () => {
    const biz = await makeBusiness({ posts: 5, onlinePosts: 5 });
    await ensureStaff({ id: biz.id, posts: 5, standPosts: 0 });
    const post1 = await db.staff.findFirstOrThrow({ where: { businessId: biz.id }, orderBy: { sortOrder: "asc" } });
    const tire = await db.service.update({ where: { id: biz.services[0].id }, data: { staff: { connect: { id: post1.id } } }, include: { staff: { select: { id: true } } } });
    const other = await db.service.create({ data: { businessId: biz.id, category: "ТО", name: "Замена масла", priceFrom: 1000, durationMin: 60 } });
    const first = await createSiteBooking(site(biz.id, other.id, 1));
    expect(first.staffId).not.toBe(post1.id);
    const results = await Promise.allSettled(Array.from({ length: 3 }, (_, i) => createSiteBooking(site(biz.id, tire.id, 10 + i))));
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await db.booking.count({ where: { businessId: biz.id, staffId: post1.id } })).toBe(1);
    const b = await db.business.findUniqueOrThrow({ where: { id: biz.id }, select: businessForSlotsSelect });
    expect((await getDaySlots(b, DATE, tire, NOW)).find((s) => s.time === "10:00")!.free).toBe(false);
    expect((await getDaySlots(b, DATE, other, NOW)).find((s) => s.time === "10:00")!.free).toBe(true);
  });
});

describe("услуги Ромашова и Шарапова, закрытие сотрудника", () => {
  async function konkurent() {
    const biz = await makeBusiness({ posts: 5, onlinePosts: 5 });
    await ensureStaff({ id: biz.id, posts: 5, standPosts: 0 });
    const posts = await db.staff.findMany({ where: { businessId: biz.id }, orderBy: { sortOrder: "asc" } });
    const [romashov, sharapov] = [posts[2], posts[4]];
    const svc = (name: string, ids: string[]) =>
      db.service.create({
        data: { businessId: biz.id, category: "Диагностика", name, priceFrom: 1500, durationMin: 60, staff: { connect: ids.map((id) => ({ id })) } },
        include: { staff: { select: { id: true } } },
      });
    const engine = await svc("Диагностика двигателя", [romashov.id, sharapov.id]);
    const electric = await svc("Диагностика электрооборудования", [sharapov.id]);
    const b = await db.business.findUniqueOrThrow({ where: { id: biz.id }, select: businessForSlotsSelect });
    const at10 = async (s: typeof engine) => (await getDaySlots(b, DATE, s, NOW)).find((x) => x.time === "10:00")!.free;
    return { biz, romashov, sharapov, engine, electric, at10 };
  }

  it("двигатель на 10:00: две машины встают к Ромашову и Шарапову, третья — нет", async () => {
    const { biz, romashov, sharapov, engine, at10 } = await konkurent();
    const results = await Promise.allSettled(Array.from({ length: 3 }, (_, i) => createSiteBooking(site(biz.id, engine.id, i))));
    const made = results.flatMap((r) => (r.status === "fulfilled" ? [r.value.staffId] : []));
    expect(made.sort()).toEqual([romashov.id, sharapov.id].sort());
    expect(await at10(engine)).toBe(false);
  });

  it("электрика только у Шарапова: занят он — окно занято, хотя Ромашов свободен", async () => {
    const { biz, sharapov, engine, electric, at10 } = await konkurent();
    const first = await createSiteBooking(site(biz.id, electric.id, 1));
    expect(first.staffId).toBe(sharapov.id);
    expect(await at10(electric)).toBe(false);
    expect(await at10(engine)).toBe(true);
  });

  it("Шарапов закрыт на день: электрика недоступна, двигатель идёт к Ромашову, общих мест на одно меньше", async () => {
    const { biz, romashov, sharapov, engine, electric, at10 } = await konkurent();
    await db.block.create({
      data: { businessId: biz.id, scope: "one_post", staffId: sharapov.id, startAt: new Date(localToUtc(DATE, 0, TZ)), endAt: new Date(localToUtc(DATE, 1440, TZ)) },
    });
    expect(await at10(electric)).toBe(false);
    expect((await createSiteBooking(site(biz.id, engine.id, 1))).staffId).toBe(romashov.id);
    // Пять постов, Шарапов закрыт, Ромашов занят: на любую услугу остаётся три места
    const any = biz.services[0];
    const results = await Promise.allSettled(Array.from({ length: 5 }, (_, i) => createSiteBooking(site(biz.id, any.id, 10 + i))));
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(3);
    expect(await db.booking.count({ where: { businessId: biz.id, staffId: sharapov.id } })).toBe(0);
  });
});

describe("несколько машин с одного номера", () => {
  it("три будущие записи можно, четвёртую нет; прошедшие и отменённые не считаются", async () => {
    const biz = await makeBusiness({ posts: 3, onlinePosts: 3 });
    const phone = "+79990002222";
    const book = (date: string, time: string, nowMs = NOW) =>
      createSiteBooking({ businessId: biz.id, serviceId: biz.services[0].id, date, time, clientName: "Иван", clientPhone: phone, car: `Kia ${time}`, nowMs, maxActivePerPhone: 3 });
    // Прошлый визит: запись так и осталась «активной», но время прошло
    await db.booking.create({
      data: { businessId: biz.id, serviceName: "Шиномонтаж", source: "site", clientPhone: phone, cancelToken: "old", startAt: new Date(NOW - 86400000), endAt: new Date(NOW - 86400000 + 3600000) },
    });
    const first = await book(DATE, "10:00");
    await book(DATE, "11:00");
    await book("2026-10-11", "10:00");
    await expect(book("2026-10-12", "10:00")).rejects.toMatchObject({ code: "too_many" });
    await db.booking.update({ where: { id: first.id }, data: { status: "cancelled" } });
    await expect(book("2026-10-12", "10:00")).resolves.toBeTruthy();
  });
});
