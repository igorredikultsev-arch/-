// Календарь кабинета (22 октября): колонки сотрудников, раскладка записей, автоназначение мастера.
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createOwnerBooking, createSiteBooking } from "@/lib/booking";
import { assignLanes, calendarLanes, sideBySide } from "@/lib/calendar";
import { db } from "@/lib/db";
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
