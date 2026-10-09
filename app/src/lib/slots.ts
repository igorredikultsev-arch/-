// Расчёт свободных окон. Раздел 4 плана. Чистые функции без базы данных.
import { addDays, hhmm, localToUtc, toLocal, weekdayOf } from "./time";

export type Interval = { start: number; end: number }; // мс UTC, [start, end)

export type HoursRow = { weekday: number; closed: boolean; openMin: number; closeMin: number; breakFromMin?: number | null; breakToMin?: number | null };
export type ExceptionRow = { date: string; closed: boolean; openMin: number | null; closeMin: number | null };

/** Часы дня; breakFrom/breakTo — обед (внутри часов работы), в это время сервис закрыт целиком. */
export type DayWindow = { openMin: number; closeMin: number; breakFrom?: number; breakTo?: number };

/**
 * Обед внутри часов дня: часть, что выходит за часы, отрезается. Сокращённый день 9:00–13:30 при обеде 13–14 —
 * обед 13:00–13:30, а не «обеда нет» (иначе водитель записался бы на время, когда мастера обедают).
 */
function withBreak(win: DayWindow, from: number | null | undefined, to: number | null | undefined): DayWindow {
  if (from == null || to == null) return win;
  const a = Math.max(from, win.openMin), b = Math.min(to, win.closeMin);
  // Особые часы целиком внутри обеда (13:00–14:00) — владелец сам решил работать в это время, обед не действует
  if (a <= win.openMin && b >= win.closeMin) return win;
  return b > a ? { ...win, breakFrom: a, breakTo: b } : win;
}

/** Часы работы на конкретную дату с учётом особых дней. null — выходной. */
export function resolveDayWindow(date: string, hours: HoursRow[], exceptions: ExceptionRow[]): DayWindow | null {
  const ex = exceptions.find((e) => e.date === date);
  const row = hours.find((h) => h.weekday === weekdayOf(date));
  if (ex) {
    if (ex.closed || ex.openMin == null || ex.closeMin == null || ex.closeMin <= ex.openMin) return null;
    // Сокращённый или изменённый день: обед этого дня недели остаётся в пределах новых часов (31 декабря 9–16, обед 13–14)
    const open = row && !row.closed;
    return withBreak({ openMin: ex.openMin, closeMin: ex.closeMin }, open ? row.breakFromMin : null, open ? row.breakToMin : null);
  }
  if (!row || row.closed || row.closeMin <= row.openMin) return null;
  return withBreak({ openMin: row.openMin, closeMin: row.closeMin }, row.breakFromMin, row.breakToMin);
}

/** Обед дня как интервал UTC, чтобы считать его закрытым временем всего сервиса. */
export function breakIntervals(date: string, tz: string, window: DayWindow | null): Interval[] {
  if (!window || window.breakFrom == null || window.breakTo == null) return [];
  return [{ start: localToUtc(date, window.breakFrom, tz), end: localToUtc(date, window.breakTo, tz) }];
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
  /** Постов под запись с сайта; не задано или не меньше posts — под запись все посты. */
  onlinePosts?: number;
  /** Записи с сайта: только они занимают посты под онлайн-запись (звонки и живая очередь идут на остальные). */
  siteBookings?: Interval[];
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
  // Посты под онлайн-запись: их занимают записи с сайта и «закрыт один пост» (владелец мог закрыть именно его).
  // Общее число постов проверяется тоже: если владелец всё же внёс звонки, перебора не будет
  const online = Math.min(input.onlinePosts ?? posts, posts);
  const onlineLane = online < posts ? [...(input.siteBookings ?? []), ...input.blocksOnePost] : null;
  const lunch = breakIntervals(date, tz, window);
  const slots: Slot[] = [];
  for (let m = window.openMin; m + durationMin <= window.closeMin; m += stepMin) {
    const start = localToUtc(date, m, tz);
    if (start < earliest) continue;
    const slot = { start, end: start + durationMin * 60000 };
    // На обед запись не предлагается вовсе, как и вне часов работы
    if (lunch.some((b) => overlaps(b, slot))) continue;
    const free =
      !input.blocksAll.some((b) => overlaps(b, slot)) && peakLoad(slot, occupied) < posts && (!onlineLane || peakLoad(slot, onlineLane) < online);
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

export type LaneSpan = { from: number; to: number }; // минуты от полуночи по местному времени

export type DayLanesInput = {
  date: string;
  tz: string;
  window: DayWindow;
  posts: number;
  bookings: Interval[];
  blocksAll: Interval[];
  blocksOnePost: Interval[];
};

/**
 * Занятость постов за день для сайта: на каком посту и когда занято. Только время, без данных клиентов.
 * Записи и закрытие одного поста раскладываются по постам жадно (как в кабинете), закрытие всего сервиса
 * занимает все посты. Пересекающиеся и соседние промежутки на одном посту склеиваются.
 */
export function dayLanes(input: DayLanesInput): { open: number; close: number; lanes: LaneSpan[][] } {
  const { date, tz, window } = input;
  const n = Math.max(input.posts, 1);
  const dayStart = localToUtc(date, 0, tz);
  const toMin = (ms: number) => Math.round((ms - dayStart) / 60000);
  const clip = (iv: Interval): LaneSpan | null => {
    const from = Math.max(toMin(iv.start), window.openMin);
    const to = Math.min(toMin(iv.end), window.closeMin);
    return to > from ? { from, to } : null;
  };
  const lanes: LaneSpan[][] = Array.from({ length: n }, () => []);
  const busyUntil = new Array<number>(n).fill(-Infinity);
  for (const iv of [...input.bookings, ...input.blocksOnePost].sort((a, b) => a.start - b.start)) {
    let lane = busyUntil.findIndex((t) => t <= iv.start);
    if (lane === -1) lane = busyUntil.indexOf(Math.min(...busyUntil));
    busyUntil[lane] = Math.max(busyUntil[lane], iv.end);
    const s = clip(iv);
    if (s) lanes[lane].push(s);
  }
  for (const iv of [...input.blocksAll, ...breakIntervals(date, tz, window)]) {
    const s = clip(iv);
    if (s) lanes.forEach((l) => l.push({ ...s }));
  }
  const merged = lanes.map((l) =>
    l
      .sort((a, b) => a.from - b.from)
      .reduce<LaneSpan[]>((acc, s) => {
        const last = acc[acc.length - 1];
        if (last && s.from <= last.to) last.to = Math.max(last.to, s.to);
        else acc.push({ ...s });
        return acc;
      }, []),
  );
  return { open: window.openMin, close: window.closeMin, lanes: merged };
}

/**
 * Когда в сервисе нет ни одного свободного поста. Это и видит клиент на сайте: какой пост занят,
 * ему неважно, важно, можно ли приехать.
 */
export function fullBusy(lanes: LaneSpan[][]): LaneSpan[] {
  if (!lanes.length) return [];
  const cuts = [...new Set(lanes.flat().flatMap((s) => [s.from, s.to]))].sort((a, b) => a - b);
  const out: LaneSpan[] = [];
  for (let i = 0; i + 1 < cuts.length; i++) {
    const from = cuts[i], to = cuts[i + 1];
    if (!lanes.every((l) => l.some((s) => s.from <= from && s.to >= to))) continue;
    const last = out[out.length - 1];
    if (last && last.to === from) last.to = to;
    else out.push({ from, to });
  }
  return out;
}

/** Объединение промежутков занятости: занято, если занято хотя бы в одном списке. */
export function unionSpans(...lists: LaneSpan[][]): LaneSpan[] {
  return lists
    .flat()
    .sort((a, b) => a.from - b.from)
    .reduce<LaneSpan[]>((acc, s) => {
      const last = acc[acc.length - 1];
      if (last && s.from <= last.to) last.to = Math.max(last.to, s.to);
      else acc.push({ ...s });
      return acc;
    }, []);
}
