// Проверки исправлений после общей проверки 3 октября: обед, возврат отменённой записи, статусы, лимит на номер.
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { BookingError, cancelByClient, createOwnerBooking, createSiteBooking, getDaySlots, businessForSlotsSelect, restoreBooking } from "@/lib/booking";
import { db } from "@/lib/db";
import { dayLanes, fullBusy, resolveDayWindow } from "@/lib/slots";
import { slugify } from "@/lib/slug";
import { localToUtc } from "@/lib/time";
import { makeBusiness, resetDb } from "./helpers";

const TZ = "Asia/Yekaterinburg";
const DATE = "2026-10-10";
const NOW = localToUtc("2026-10-05", 600, TZ);
const site = (businessId: string, serviceId: string, n: number, time = "10:00") => ({
  businessId, serviceId, date: DATE, time, clientName: `Клиент ${n}`, clientPhone: `+7999000${String(n).padStart(4, "0")}`, car: "Kia Rio", nowMs: NOW,
});
const slotsFor = async (id: string, duration = 40) =>
  getDaySlots(await db.business.findUniqueOrThrow({ where: { id }, select: businessForSlotsSelect }), DATE, duration, NOW);

beforeEach(resetDb);
afterAll(() => db.$disconnect());

describe("обед в часах работы", () => {
  it("окна не пересекают обед, на витрине обед — занято целиком", async () => {
    const biz = await makeBusiness({ posts: 2 });
    await db.workingHours.updateMany({ where: { businessId: biz.id }, data: { breakFromMin: 780, breakToMin: 840 } });
    const times = (await slotsFor(biz.id)).map((s) => s.time);
    expect(times).toContain("12:00"); // 12:00-12:40
    expect(times).not.toContain("12:30"); // 12:30-13:10 задевает обед
    expect(times).not.toContain("13:00");
    expect(times).toContain("14:00");
    const hours = await db.workingHours.findMany({ where: { businessId: biz.id } });
    const win = resolveDayWindow(DATE, hours, [])!;
    const lanes = dayLanes({ date: DATE, tz: TZ, window: win, posts: 2, bookings: [], blocksAll: [], blocksOnePost: [] });
    expect(fullBusy(lanes.lanes)).toEqual([{ from: 780, to: 840 }]);
  });

  it("обед вне часов работы не учитывается", () => {
    const win = resolveDayWindow(DATE, [{ weekday: 6, closed: false, openMin: 540, closeMin: 1200, breakFromMin: 1210, breakToMin: 1260 }], []);
    expect(win).toEqual({ openMin: 540, closeMin: 1200 });
  });

  it("запись владельца на обед — с предупреждением", async () => {
    const biz = await makeBusiness();
    await db.workingHours.updateMany({ where: { businessId: biz.id }, data: { breakFromMin: 780, breakToMin: 840 } });
    const r = await createOwnerBooking({ businessId: biz.id, serviceId: biz.services[0].id, date: DATE, startMin: 790 });
    expect(r.booking).toBeNull();
    expect(r.warning?.allClosed).toBe(true);
  });
});

describe("запись владельца вне часов", () => {
  it("за закрытием — предупреждение", async () => {
    const biz = await makeBusiness();
    const r = await createOwnerBooking({ businessId: biz.id, serviceId: biz.services[0].id, date: DATE, startMin: 1190 });
    expect(r.warning?.outside).toBe(true);
  });
});

describe("возврат отменённой записи", () => {
  it("если время заняли, без подтверждения не возвращается", async () => {
    const biz = await makeBusiness({ posts: 1 });
    const sid = biz.services[0].id;
    const first = await createSiteBooking(site(biz.id, sid, 1));
    await db.booking.update({ where: { id: first.id }, data: { status: "cancelled" } });
    await createSiteBooking(site(biz.id, sid, 2));
    const r = await restoreBooking(first.id, biz.id);
    expect(r.ok).toBe(false);
    expect((await db.booking.findUniqueOrThrow({ where: { id: first.id } })).status).toBe("cancelled");
    const forced = await restoreBooking(first.id, biz.id, true);
    expect(forced.ok).toBe(true);
  });

  it("если время свободно, возвращается сразу", async () => {
    const biz = await makeBusiness({ posts: 1 });
    const first = await createSiteBooking(site(biz.id, biz.services[0].id, 1));
    await db.booking.update({ where: { id: first.id }, data: { status: "cancelled" } });
    expect((await restoreBooking(first.id, biz.id)).ok).toBe(true);
  });
});

describe("статусы записей", () => {
  it("«Выполнена» занимает время, как активная", async () => {
    const biz = await makeBusiness({ posts: 1 });
    const b = await createSiteBooking(site(biz.id, biz.services[0].id, 1));
    await db.booking.update({ where: { id: b.id }, data: { status: "done" } });
    const slot = (await slotsFor(biz.id)).find((s) => s.time === "10:00")!;
    expect(slot.free).toBe(false);
  });

  it("отмена выполненной записи клиентом — понятный текст", async () => {
    const biz = await makeBusiness();
    const b = await createSiteBooking(site(biz.id, biz.services[0].id, 1));
    await db.booking.update({ where: { id: b.id }, data: { status: "done" } });
    await expect(cancelByClient(b.cancelToken, NOW)).rejects.toThrow("уже выполнена");
  });
});

describe("лимит записей на один номер", () => {
  it("четвёртая будущая запись на тот же номер отклоняется", async () => {
    const biz = await makeBusiness({ posts: 5 });
    const sid = biz.services[0].id;
    for (const t of ["10:00", "11:00", "12:00"]) await createSiteBooking({ ...site(biz.id, sid, 1, t), maxActivePerPhone: 3 });
    await expect(createSiteBooking({ ...site(biz.id, sid, 1, "13:00"), maxActivePerPhone: 3 })).rejects.toBeInstanceOf(BookingError);
  });
});

describe("адрес сайта из названия", () => {
  it("не заканчивается дефисом после обрезки", () => {
    const s = slugify("Шиномонтаж Колесо на Комсомольском проспекте у дома 5");
    expect(s.endsWith("-")).toBe(false);
    expect(s.length).toBeLessThanOrEqual(40);
  });
});
