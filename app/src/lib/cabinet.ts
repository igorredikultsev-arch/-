// Данные для кабинета владельца: день по постам, неделя.
import type { Block, Booking, Business } from "@prisma/client";
import { db } from "./db";
import { assignLanes, calendarLanes, type Lane } from "./calendar";
import { dayBounds, resolveDayWindow } from "./slots";
import { addDays, toLocal } from "./time";

export type LoadItem = { startPct: number; widthPct: number; closed: boolean; overflow: boolean };
export type LoadRow = { id: string; name: string; color: string; items: LoadItem[] };

/**
 * «Загрузка постов»: строка на каждый пост (сотрудника) его цветом, как колонки календаря. Запись без поста — на свободный пост
 * своего вида. overflow — запись легла поверх другой на том же посту.
 */
export function postLoad(
  lanes: Lane[],
  window: { start: number; end: number },
  items: { id: string; start: number; end: number; staffId: string | null; onStand: boolean; closed: boolean }[],
): { rows: LoadRow[]; laneOf: Map<string, string> } {
  const laneOf = assignLanes(items, lanes);
  const span = Math.max(window.end - window.start, 1);
  const rows = lanes.map((l) => {
    const mine = items.filter((it) => laneOf.get(it.id) === l.id).sort((a, b) => a.start - b.start);
    const out: LoadItem[] = [];
    mine.forEach((it, i) => {
      const s = Math.max(it.start, window.start), e = Math.min(it.end, window.end);
      if (e <= s) return;
      const overflow = !it.closed && mine.some((o, j) => j < i && !o.closed && o.end > it.start);
      out.push({ startPct: ((s - window.start) / span) * 100, widthPct: ((e - s) / span) * 100, closed: it.closed, overflow });
    });
    return { id: l.id, name: l.name, color: l.color, items: out };
  });
  return { rows, laneOf };
}

export type DayData = Awaited<ReturnType<typeof loadDayForOwner>>;

export async function loadDayForOwner(business: Business, date: string) {
  const tz = business.timezone;
  const [hours, exceptions] = await Promise.all([
    db.workingHours.findMany({ where: { businessId: business.id } }),
    db.dayException.findMany({ where: { businessId: business.id, date } }),
  ]);
  const win = resolveDayWindow(date, hours, exceptions);
  const bounds = dayBounds(date, tz);
  const [bookings, blocks] = await Promise.all([
    db.booking.findMany({
      where: { businessId: business.id, startAt: { gte: new Date(bounds.start), lt: new Date(bounds.end) } },
      orderBy: { startAt: "asc" },
    }),
    db.block.findMany({
      where: { businessId: business.id, startAt: { gte: new Date(bounds.start - 86400000), lt: new Date(bounds.end) }, endAt: { gt: new Date(bounds.start) } },
      orderBy: { startAt: "asc" },
    }),
  ]);
  const openMin = win?.openMin ?? 540;
  const closeMin = win?.closeMin ?? 1200;
  const window = { start: bounds.start + openMin * 60000, end: bounds.start + closeMin * 60000 };
  // Точнее через localToUtc, но в России нет перехода на летнее время, а для полосы загрузки этого достаточно
  const active = bookings.filter((b) => b.status === "active" || b.status === "done");
  const staff = await db.staff.findMany({ where: { businessId: business.id }, orderBy: [{ sortOrder: "asc" }, { id: "asc" }], select: { id: true, name: true, color: true, onStand: true } });
  const lanes = calendarLanes(staff, business.posts, business.standPosts);
  const load = postLoad(lanes, window, [
    ...active.map((b) => ({ id: b.id, start: b.startAt.getTime(), end: b.endAt.getTime(), staffId: b.staffId, onStand: b.onStand, closed: false })),
    // Закрытое время сотрудника — в его строке; закрытый один пост без сотрудника — на свободный пост
    ...blocks.filter((b) => b.staffId || b.scope === "one_post").map((b) => ({ id: `x:${b.id}`, start: b.startAt.getTime(), end: b.endAt.getTime(), staffId: b.staffId, onStand: false, closed: true })),
  ]);
  // Кто делает запись — в списке под временем, цветом поста, как в календаре
  const laneById = new Map(lanes.map((l) => [l.id, l]));
  const postOf = (bookingId: string) => { const l = laneById.get(load.laneOf.get(bookingId) ?? ""); return l ? { name: l.name, color: l.color } : null; };
  const span = window.end - window.start;
  const lunch = win?.breakFrom != null && win.breakTo != null ? { start: bounds.start + win.breakFrom * 60000, end: bounds.start + win.breakTo * 60000 } : null;
  const closedAll = [
    ...blocks.filter((b) => b.scope === "all" && !b.staffId).map((b) => ({ start: b.startAt.getTime(), end: b.endAt.getTime() })),
    ...(lunch ? [lunch] : []),
  ]
    .map((b) => {
      const s = Math.max(b.start, window.start);
      const e = Math.min(b.end, window.end);
      return e > s ? { startPct: ((s - window.start) / span) * 100, widthPct: ((e - s) / span) * 100 } : null;
    })
    .filter(Boolean) as { startPct: number; widthPct: number }[];
  const nowPct = Date.now() >= window.start && Date.now() <= window.end ? ((Date.now() - window.start) / span) * 100 : null;
  const revenue = active.filter((b) => b.status !== "no_show").reduce((sum, b) => sum + (b.priceFrom ?? 0), 0);

  return {
    date,
    isWorkday: !!win,
    openMin,
    closeMin,
    lunch,
    bookings,
    blocks,
    rows: load.rows,
    postOf,
    closedAll,
    nowPct,
    stats: {
      total: active.length,
      fromSite: active.filter((b) => b.source === "site").length,
      revenue,
    },
  };
}

/** Записи и закрытое время одной лентой по времени — для списка на экране «Сегодня». */
export type TimelineEntry =
  | { type: "booking"; at: number; booking: Booking }
  | { type: "block"; at: number; block: Block }
  | { type: "lunch"; at: number; end: number };

export function timeline(day: DayData): TimelineEntry[] {
  return [
    ...day.bookings.map((b) => ({ type: "booking" as const, at: b.startAt.getTime(), booking: b })),
    ...day.blocks.map((b) => ({ type: "block" as const, at: b.startAt.getTime(), block: b })),
    ...(day.lunch && day.bookings.length + day.blocks.length > 0 ? [{ type: "lunch" as const, at: day.lunch.start, end: day.lunch.end }] : []),
  ].sort((a, b) => a.at - b.at);
}

export function partOfDay(ms: number, tz: string): "Утро" | "День" | "Вечер" {
  const m = toLocal(ms, tz).minutes;
  return m < 720 ? "Утро" : m < 1020 ? "День" : "Вечер";
}

export async function loadWeek(business: Business, startDate: string) {
  const dates = Array.from({ length: 7 }, (_, i) => addDays(startDate, i));
  const from = dayBounds(dates[0], business.timezone).start;
  const to = dayBounds(dates[6], business.timezone).end;
  const [bookings, hours, exceptions] = await Promise.all([
    db.booking.findMany({
      where: { businessId: business.id, status: { in: ["active", "done"] }, startAt: { gte: new Date(from), lt: new Date(to) } },
      orderBy: { startAt: "asc" },
    }),
    db.workingHours.findMany({ where: { businessId: business.id } }),
    db.dayException.findMany({ where: { businessId: business.id, date: { in: dates } } }),
  ]);
  return dates.map((date) => {
    const list = bookings.filter((b) => toLocal(b.startAt.getTime(), business.timezone).date === date);
    return { date, isWorkday: !!resolveDayWindow(date, hours, exceptions), bookings: list, fromSite: list.filter((b) => b.source === "site").length };
  });
}

/** Календарь: записи (без отменённых), закрытое время, часы работы и сотрудники за несколько дней. */
export async function loadCalendar(business: Business, dates: string[]) {
  const tz = business.timezone;
  const from = dayBounds(dates[0], tz).start;
  const to = dayBounds(dates[dates.length - 1], tz).end;
  const [bookings, blocks, hours, exceptions, staff, notes] = await Promise.all([
    db.booking.findMany({
      where: { businessId: business.id, status: { in: ["active", "done", "no_show"] }, startAt: { gte: new Date(from - 86400000), lt: new Date(to) }, endAt: { gt: new Date(from) } },
      orderBy: { startAt: "asc" },
      select: {
        id: true, startAt: true, endAt: true, status: true, source: true, serviceName: true, clientName: true, car: true, clientPhone: true,
        staffId: true, onStand: true, externalId: true, serviceId: true, createdBy: { select: { name: true, phone: true } },
      },
    }),
    db.block.findMany({ where: { businessId: business.id, startAt: { gte: new Date(from - 86400000), lt: new Date(to) }, endAt: { gt: new Date(from) } } }),
    db.workingHours.findMany({ where: { businessId: business.id } }),
    db.dayException.findMany({ where: { businessId: business.id, date: { in: dates } } }),
    db.staff.findMany({ where: { businessId: business.id }, orderBy: [{ sortOrder: "asc" }, { id: "asc" }], select: { id: true, name: true, color: true, onStand: true } }),
    db.calendarNote.findMany({
      where: { businessId: business.id, startDate: { lte: dates[dates.length - 1] }, endDate: { gte: dates[0] } },
      orderBy: [{ startDate: "asc" }, { createdAt: "asc" }],
      select: { id: true, title: true, startDate: true, endDate: true, staffId: true },
    }),
  ]);
  const days = dates.map((date) => {
    const win = resolveDayWindow(date, hours, exceptions);
    const start = dayBounds(date, tz).start;
    return { date, start, win };
  });
  return { bookings, blocks, days, staff, notes };
}
