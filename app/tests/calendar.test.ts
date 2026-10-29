// Календарь кабинета (22 октября): колонки сотрудников, раскладка записей, автоназначение мастера.
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createOwnerBooking, createSiteBooking, updateOwnerBooking } from "@/lib/booking";
import { assignLanes, calendarLanes, sideBySide } from "@/lib/calendar";
import { db } from "@/lib/db";
import { findPhone } from "@/lib/phone";
import { ensureStaff } from "@/lib/staff";
import { localToUtc } from "@/lib/time";
import { makeBusiness, resetDb } from "./helpers";

const H = 3600000;
const item = (id: string, from: number, to: number, over: { staffId?: string; onStand?: boolean } = {}) => ({
  id, start: from * H, end: to * H, staffId: over.staffId ?? null, onStand: over.onStand ?? false,
});

describe("колонки и раскладка", () => {
  it("без сотрудников — «Пост 1…N» и стенд по настройкам", () => {
    const lanes = calendarLanes([], 5, 1);
    expect(lanes.map((l) => l.name)).toEqual(["Пост 1", "Пост 2", "Пост 3", "Пост 4", "Пост 5", "Стенд развала"]);
    expect(lanes.every((l) => l.virtual)).toBe(true);
  });

  it("запись с сотрудником — в его колонке, даже если там уже занято (наложения не запрещаем)", () => {
    const lanes = calendarLanes([{ id: "a", name: "Андрей", color: "#000000", onStand: false }, { id: "b", name: "Борис", color: "#111111", onStand: false }], 2, 0);
    const map = assignLanes([item("1", 10, 12, { staffId: "a" }), item("2", 11, 13, { staffId: "a" })], lanes);
    expect([map.get("1"), map.get("2")]).toEqual(["a", "a"]);
  });

  it("запись без сотрудника — в первую свободную колонку своего вида", () => {
    const lanes = calendarLanes([], 2, 1);
    const map = assignLanes([item("1", 10, 12), item("2", 11, 13), item("3", 11, 12, { onStand: true }), item("4", 12, 14)], lanes);
    expect(Object.fromEntries(map)).toEqual({ "1": "post-1", "2": "post-2", "3": "stand-1", "4": "post-1" });
  });

  it("пересекающиеся записи встают рядом, непересекающиеся — во всю ширину", () => {
    const pos = sideBySide([item("1", 10, 12), item("2", 11, 13), item("3", 12, 13), item("4", 14, 15)]);
    expect(pos.get("1")).toEqual({ col: 0, cols: 2 });
    expect(pos.get("2")).toEqual({ col: 1, cols: 2 });
    expect(pos.get("3")).toEqual({ col: 0, cols: 2 });
    expect(pos.get("4")).toEqual({ col: 0, cols: 1 });
  });
});

const TZ = "Asia/Yekaterinburg";
const DATE = "2026-10-10";
const NOW = localToUtc("2026-10-05", 600, TZ);

beforeEach(resetDb);
afterAll(() => db.$disconnect());

describe("к какому сотруднику встаёт запись", () => {
  it("запись с сайта — к первому свободному мастеру, на развал — к мастеру стенда", async () => {
    const biz = await makeBusiness({ posts: 2, onlinePosts: 2 });
    await db.business.update({ where: { id: biz.id }, data: { standPosts: 1 } });
    const [a, b, s] = await Promise.all(
      [["Андрей", false], ["Борис", false], ["Стенд", true]].map(([name, onStand], i) =>
        db.staff.create({ data: { businessId: biz.id, name: name as string, color: "#2563eb", onStand: onStand as boolean, sortOrder: i } })),
    );
    const align = await db.service.create({ data: { businessId: biz.id, category: "Развал", name: "Развал", priceFrom: 2500, durationMin: 60, onStand: true } });
    const site = (n: number, serviceId: string) => createSiteBooking({
      businessId: biz.id, serviceId, date: DATE, time: "10:00", clientName: `К ${n}`, clientPhone: `+7999100${String(n).padStart(4, "0")}`, car: "Kia", nowMs: NOW,
    });
    const first = await site(1, biz.services[0].id);
    const second = await site(2, biz.services[0].id);
    const stand = await site(3, align.id);
    expect([first.staffId, second.staffId, stand.staffId]).toEqual([a.id, b.id, s.id]);
  });

  it("владелец ставит к выбранному мастеру поверх занятого и запоминается, кто внёс", async () => {
    const biz = await makeBusiness({ posts: 2, onlinePosts: 2 });
    const a = await db.staff.create({ data: { businessId: biz.id, name: "Андрей", color: "#2563eb" } });
    const owner = await db.user.create({ data: { phone: "+79990000001", passwordHash: "x", businessId: biz.id, name: "Сергей" } });
    await createOwnerBooking({ businessId: biz.id, custom: { title: "Колодки", durationMin: 60 }, date: DATE, startMin: 600, staffId: a.id, createdById: owner.id });
    const r = await createOwnerBooking({ businessId: biz.id, custom: { title: "Масло", durationMin: 60 }, date: DATE, startMin: 600, staffId: a.id, createdById: owner.id });
    expect(r.booking).toMatchObject({ staffId: a.id, createdById: owner.id });
  });
});

describe("запись одним полем", () => {
  it("находит телефон в тексте", () => {
    expect(findPhone("Колодки, Андрей, Камри, 8 910 123-45-67")).toBe("+79101234567");
    expect(findPhone("ТО +7(910)1234567 вечером")).toBe("+79101234567");
    expect(findPhone("Иван 9101234567")).toBe("+79101234567");
    expect(findPhone("Шиномонтаж R16, 4 колеса, 2500 ₽")).toBeNull();
    expect(findPhone("заказ 123456789012")).toBeNull();
  });
});

describe("посты как колонки календаря", () => {
  it("без постов создаются «Пост 1…N» и «Стенд развала», второй раз — не дублируются", async () => {
    const biz = await makeBusiness({ posts: 3, onlinePosts: 3 });
    await Promise.all([ensureStaff({ ...biz, standPosts: 1 }), ensureStaff({ ...biz, standPosts: 1 })]);
    const staff = await db.staff.findMany({ where: { businessId: biz.id }, orderBy: { sortOrder: "asc" } });
    expect(staff.map((s) => [s.name, s.onStand])).toEqual([["Пост 1", false], ["Пост 2", false], ["Пост 3", false], ["Стенд развала", true]]);
  });

  it("запись меняется: текст, время, длительность, пост; занятость считается без неё самой", async () => {
    const biz = await makeBusiness({ posts: 1, onlinePosts: 1 });
    const [p1, p2] = await Promise.all(["Пост 1", "Пост 2"].map((name) => db.staff.create({ data: { businessId: biz.id, name, color: "#2563eb" } })));
    const made = await createOwnerBooking({ businessId: biz.id, custom: { title: "Колодки", durationMin: 60 }, date: DATE, startMin: 600, staffId: p1.id });
    const id = made.booking!.id;
    // Сдвиг на полчаса пересекается только с самой собой: без предупреждения
    const moved = await updateOwnerBooking({ id, businessId: biz.id, custom: { title: "Колодки и ходовая, Андрей", durationMin: 120 }, date: DATE, startMin: 630, staffId: p2.id, clientPhone: "+79101234567" });
    expect(moved.warning).toBeNull();
    expect(moved.booking).toMatchObject({ serviceName: "Колодки и ходовая, Андрей", staffId: p2.id, clientPhone: "+79101234567" });
    expect(moved.booking!.endAt.getTime() - moved.booking!.startAt.getTime()).toBe(120 * 60000);
    // Второй записи на единственный пост — предупреждение, пока не подтвердят
    const other = await createOwnerBooking({ businessId: biz.id, custom: { title: "Масло", durationMin: 60 }, date: DATE, startMin: 900, force: true });
    const clash = await updateOwnerBooking({ id: other.booking!.id, businessId: biz.id, custom: { title: "Масло", durationMin: 60 }, date: DATE, startMin: 660 });
    expect(clash.booking).toBeNull();
    expect(clash.warning).toMatchObject({ load: 1, posts: 1 });
  });

  it("запись с услугой можно сделать дольше обычного: машину оставили на полдня", async () => {
    const biz = await makeBusiness({ posts: 1, onlinePosts: 1 });
    const svc = biz.services[0];
    const len = (b: { startAt: Date; endAt: Date } | null) => (b!.endAt.getTime() - b!.startAt.getTime()) / 60000;
    const made = await createOwnerBooking({ businessId: biz.id, serviceId: svc.id, date: DATE, startMin: 600 });
    expect(len(made.booking)).toBe(svc.durationMin);
    const longer = await updateOwnerBooking({ id: made.booking!.id, businessId: biz.id, serviceId: svc.id, durationMin: 180, date: DATE, startMin: 600 });
    expect(longer.booking).toMatchObject({ serviceId: svc.id, serviceName: svc.name });
    expect(len(longer.booking)).toBe(180);
    const fresh = await createOwnerBooking({ businessId: biz.id, serviceId: svc.id, durationMin: 240, date: DATE, startMin: 840, force: true });
    expect(len(fresh.booking)).toBe(240);
  });
});
