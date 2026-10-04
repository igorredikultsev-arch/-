// Работа с местным временем автосервиса. В базе всё хранится в UTC,
// а часы работы и выбор дня у клиента — в часовом поясе сервиса (Пермь: Asia/Yekaterinburg, UTC+5).

export type LocalParts = { date: string; minutes: number; weekday: number };

const dtfCache = new Map<string, Intl.DateTimeFormat>();
function dtf(tz: string) {
  let f = dtfCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
      weekday: "short",
    });
    dtfCache.set(tz, f);
  }
  return f;
}

const WEEKDAYS: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };

/** Местные дата, минуты от полуночи и день недели (1 = пн … 7 = вс) для момента времени. */
export function toLocal(ms: number, tz: string): LocalParts {
  const parts = Object.fromEntries(dtf(tz).formatToParts(new Date(ms)).map((p) => [p.type, p.value]));
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
    weekday: WEEKDAYS[parts.weekday],
  };
}

/** Смещение часового пояса относительно UTC в минутах в данный момент. */
export function offsetMinutes(ms: number, tz: string): number {
  const l = toLocal(ms, tz);
  const [y, m, d] = l.date.split("-").map(Number);
  const asUtc = Date.UTC(y, m - 1, d, 0, l.minutes);
  return Math.round((asUtc - Math.floor(ms / 60000) * 60000) / 60000);
}

/** Момент UTC (мс) для местной даты «YYYY-MM-DD» и минут от полуночи. Минуты могут быть ≥ 1440. */
export function localToUtc(date: string, minutes: number, tz: string): number {
  const [y, m, d] = date.split("-").map(Number);
  const naive = Date.UTC(y, m - 1, d, 0, minutes);
  let guess = naive - offsetMinutes(naive, tz) * 60000;
  // Второй проход на случай перехода на летнее время в других поясах
  guess = naive - offsetMinutes(guess, tz) * 60000;
  return guess;
}

export function addDays(date: string, n: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return t.toISOString().slice(0, 10);
}

export function weekdayOf(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return wd === 0 ? 7 : wd;
}

export function isDateString(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
}

export function hhmm(minutes: number): string {
  // Конец дня — «24:00», а не «00:00»: иначе закрытие в полночь читается как начало дня и не сохраняется обратно
  if (minutes === 1440) return "24:00";
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function parseHhmm(s: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 24 || min > 59 || (h === 24 && min > 0)) return null;
  return h * 60 + min;
}

const MONTHS_GEN = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
const WEEKDAY_FULL = ["", "понедельник", "вторник", "среда", "четверг", "пятница", "суббота", "воскресенье"];
const WEEKDAY_SHORT = ["", "пн", "вт", "ср", "чт", "пт", "сб", "вс"];

export function formatDayLong(date: string): string {
  const [, m, d] = date.split("-").map(Number);
  const wd = WEEKDAY_FULL[weekdayOf(date)];
  return `${wd[0].toUpperCase()}${wd.slice(1)}, ${d} ${MONTHS_GEN[m - 1]}`;
}

export function formatDayShort(date: string): { weekday: string; day: number; month: string } {
  const [, m, d] = date.split("-").map(Number);
  return { weekday: WEEKDAY_SHORT[weekdayOf(date)], day: d, month: MONTHS_GEN[m - 1] };
}

/** «12 октября» по местному времени. */
export function formatDate(ms: number, tz: string): string {
  const { day, month } = formatDayShort(toLocal(ms, tz).date);
  return `${day} ${month}`;
}

export function formatDateTime(ms: number, tz: string): string {
  const l = toLocal(ms, tz);
  return `${formatDayLong(l.date)}, ${hhmm(l.minutes)}`;
}
