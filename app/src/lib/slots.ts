// Расчёт свободных окон. Раздел 4 плана. Чистые функции без базы данных.
import { addDays, hhmm, localToUtc, toLocal, weekdayOf } from "./time";

export type Interval = { start: number; end: number }; // мс UTC, [start, end)

export type HoursRow = { weekday: number; closed: boolean; openMin: number; closeMin: number };
export type ExceptionRow = { date: string; closed: boolean; openMin: number | null; closeMin: number | null };

export type DayWindow = { openMin: number; closeMin: number };

/** Часы работы на конкретную дату с учётом особых дней. null — выходной. */
export function resolveDayWindow(date: string, hours: HoursRow[], exceptions: ExceptionRow[]): DayWindow | null {
  const ex = exceptions.find((e) => e.date === date);
  if (ex) {
    if (ex.closed || ex.openMin == null || ex.closeMin == null) return null;
    return ex.closeMin > ex.openMin ? { openMin: ex.openMin, closeMin: ex.closeMin } : null;
  }
  const row = hours.find((h) => h.weekday === weekdayOf(date));
  if (!row || row.closed || row.closeMin <= row.openMin) return null;
  return { openMin: row.openMin, closeMin: row.closeMin };
}

const overlaps = (a: Interval, b: Interval) => a.start < b.end && b.start < a.end;

/**
 * Наибольшая занятость постов внутри интервала [start, end).
 * Занятость кусочно-постоянна и растёт только в начале чьего-то интервала,
 * поэтому достаточно проверить сам start и все начала, попавшие внутрь.
 */
export function peakLoad(slot: Interval, occupied: Interval[]): number {
  const inside = occupied.filter((o) => overlaps(o, slot));
  const points = [slot.start, ...inside.map((o) => o.start).filter((s) => s > slot.start && s < slot.end)];
  let peak = 0;
  for (const p of points) {
    const n = inside.filter((o) => o.start <= p && p < o.end).length;
    if (n > peak) peak = n;
  }
  return peak;
}

export type SlotInput = {
  date: string; // местная дата «YYYY-MM-DD»
  tz: string;
  window: DayWindow | null;
  durationMin: number;
  stepMin: number;
  posts: number;
  bookings: Interval[]; // активные записи (каждая занимает один пост)
  blocksAll: Interval[]; // закрыт весь сервис
  blocksOnePost: Interval[]; // закрыт один пост
  nowMs: number;
  minLeadMin: number;
};

export type Slot = { time: string; start: number; end: number; free: boolean };

/** Все окна дня по сетке с признаком «свободно». Время раньше «сейчас + запас» не показывается. */
export function daySlots(input: SlotInput): Slot[] {
  const { date, tz, window, durationMin, stepMin, posts } = input;
  if (!window || durationMin <= 0 || stepMin <= 0 || posts <= 0) return [];
  const earliest = input.nowMs + input.minLeadMin * 60000;
  const occupied = [...input.bookings, ...input.blocksOnePost];
  const slots: Slot[] = [];
  for (let m = window.openMin; m + durationMin <= window.closeMin; m += stepMin) {
    const start = localToUtc(date, m, tz);
    if (start < earliest) continue;
    const slot = { start, end: start + durationMin * 60000 };
    const free = !input.blocksAll.some((b) => overlaps(b, slot)) && peakLoad(slot, occupied) < posts;
    slots.push({ time: hhmm(m), start: slot.start, end: slot.end, free });
  }
  return slots;
}

/** Дата входит в горизонт записи: от сегодняшнего дня (по местному времени) до сегодня + horizonDays − 1. */
export function inHorizon(date: string, nowMs: number, tz: string, horizonDays: number): boolean {
  const today = toLocal(nowMs, tz).date;
  return date >= today && date <= addDays(today, horizonDays - 1);
}

/** Список дат горизонта начиная с сегодняшней. */
export function horizonDates(nowMs: number, tz: string, horizonDays: number): string[] {
  const today = toLocal(nowMs, tz).date;
  return Array.from({ length: horizonDays }, (_, i) => addDays(today, i));
}

/** Границы местного дня в UTC — для выборки записей из базы. */
export function dayBounds(date: string, tz: string): Interval {
  return { start: localToUtc(date, 0, tz), end: localToUtc(addDays(date, 1), 0, tz) };
}
