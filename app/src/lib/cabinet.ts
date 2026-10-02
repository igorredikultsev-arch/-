// Данные для кабинета владельца: день по постам, неделя.
import type { Block, Booking, Business } from "@prisma/client";
import { db } from "./db";
import { dayBounds, resolveDayWindow } from "./slots";
import { addDays, toLocal } from "./time";

export type LaneItem = { kind: "site" | "owner" | "one_post"; startPct: number; widthPct: number; overflow?: boolean };

/** Раскладывает записи и закрытия одного поста по дорожкам «Пост 1…N» жадно по времени начала. */
export function layoutLanes(
  posts: number,
  window: { start: number; end: number },
  items: { start: number; end: number; kind: LaneItem["kind"] }[],
): LaneItem[][] {
  const lanes: LaneItem[][] = Array.from({ length: Math.max(posts, 1) }, () => []);
  const busyUntil = new Array(lanes.length).fill(-Infinity);
  const span = Math.max(window.end - window.start, 1);
  for (const it of [...items].sort((a, b) => a.start - b.start)) {
    let lane = busyUntil.findIndex((t) => t <= it.start);
    const overflow = lane === -1;
    if (overflow) lane = lanes.length - 1;
    busyUntil[lane] = Math.max(busyUntil[lane], it.end);
    const s = Math.max(it.start, window.start);
    const e = Math.min(it.end, window.end);
    if (e <= s) continue;
    lanes[lane].push({ kind: it.kind, startPct: ((s - window.start) / span) * 100, widthPct: ((e - s) / span) * 100, overflow });
  }
  return lanes;
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
      where: { businessId: business.id, startAt: { lt: new Date(bounds.end) }, endAt: { gt: new Date(bounds.start) } },
      orderBy: { startAt: "asc" },
    }),
  ]);
  const openMin = win?.openMin ?? 540;
  const closeMin = win?.closeMin ?? 1200;
  const window = { start: bounds.start + openMin * 60000, end: bounds.start + closeMin * 60000 };
  // Точнее через localToUtc, но в России нет перехода на летнее время, а для полосы загрузки этого достаточно
  const active = bookings.filter((b) => b.status === "active" || b.status === "done");
  const lanes = layoutLanes(business.posts, window, [
    ...active.map((b) => ({ start: b.startAt.getTime(), end: b.endAt.getTime(), kind: b.source })),
    ...blocks.filter((b) => b.scope === "one_post").map((b) => ({ start: b.startAt.getTime(), end: b.endAt.getTime(), kind: "one_post" as const })),
  ]);
  const span = window.end - window.start;
  const closedAll = blocks
    .filter((b) => b.scope === "all")
    .map((b) => {
      const s = Math.max(b.startAt.getTime(), window.start);
      const e = Math.min(b.endAt.getTime(), window.end);
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
    bookings,
    blocks,
    lanes,
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
export type TimelineEntry = { type: "booking"; at: number; booking: Booking } | { type: "block"; at: number; block: Block };

export function timeline(day: DayData): TimelineEntry[] {
  return [
    ...day.bookings.map((b) => ({ type: "booking" as const, at: b.startAt.getTime(), booking: b })),
    ...day.blocks.map((b) => ({ type: "block" as const, at: b.startAt.getTime(), block: b })),
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
