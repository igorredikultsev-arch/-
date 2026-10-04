// Простая статистика для владельца (версия 2 плана, раздел 3): сколько записей, сколько из них сделали клиенты сами на сайте,
// примерная сумма по ценам «от», неявки и отмены, популярные услуги. Главное, что должен видеть владелец: сайт приносит клиентов.
import { db } from "./db";
import { dayBounds } from "./slots";
import { addDays, toLocal } from "./time";

export const PERIODS = [7, 30, 90] as const;
export type Period = (typeof PERIODS)[number];

type Row = { startAt: Date; source: "site" | "owner"; status: "active" | "cancelled" | "no_show" | "done"; serviceName: string; priceFrom: number | null };

export type Bucket = { label: string; from: string; site: number; owner: number };

export type Stats = {
  total: number; // записи без отменённых: состоялись, впереди сегодня или клиент не приехал
  site: number;
  owner: number;
  revenue: number; // по ценам «от», без отмен и неявок
  noShow: number;
  cancelled: number;
  services: { name: string; count: number }[];
  buckets: Bucket[];
};

const MONTHS = ["янв", "фев", "мар", "апр", "мая", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];
const short = (date: string) => `${Number(date.slice(8))} ${MONTHS[Number(date.slice(5, 7)) - 1]}`;

/** Сводка по записям периода с первого по последний день включительно. 90 дней — по неделям, иначе по дням. */
export function summarize(rows: Row[], firstDay: string, lastDay: string, tz: string): Stats {
  const days: string[] = [];
  for (let d = firstDay; d <= lastDay; d = addDays(d, 1)) days.push(d);
  const step = days.length > 31 ? 7 : 1;
  const buckets: Bucket[] = [];
  for (let i = 0; i < days.length; i += step) {
    const from = days[i];
    buckets.push({ label: step === 1 ? short(from) : `${short(from)} – ${short(days[Math.min(i + step, days.length) - 1])}`, from, site: 0, owner: 0 });
  }
  const s: Stats = { total: 0, site: 0, owner: 0, revenue: 0, noShow: 0, cancelled: 0, services: [], buckets };
  const byService = new Map<string, number>();
  for (const r of rows) {
    if (r.status === "cancelled") {
      s.cancelled++;
      continue;
    }
    s.total++;
    s[r.source]++;
    if (r.status === "no_show") s.noShow++;
    else s.revenue += r.priceFrom ?? 0;
    byService.set(r.serviceName, (byService.get(r.serviceName) ?? 0) + 1);
    const date = toLocal(r.startAt.getTime(), tz).date;
    const idx = Math.floor(days.indexOf(date) / step);
    if (idx >= 0) buckets[idx][r.source]++;
  }
  s.services = [...byService].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "ru")).slice(0, 5);
  return s;
}

/** Статистика за последние period дней по сегодня, та же за прошлый такой же срок и сколько записей уже впереди. */
export async function loadStats(business: { id: string; timezone: string }, period: Period, now = Date.now()) {
  const tz = business.timezone;
  const today = toLocal(now, tz).date;
  const first = addDays(today, -(period - 1));
  const prevFirst = addDays(first, -period);
  const select = { startAt: true, source: true, status: true, serviceName: true, priceFrom: true } as const;
  const range = (a: string, b: string) => ({ businessId: business.id, startAt: { gte: new Date(dayBounds(a, tz).start), lt: new Date(dayBounds(b, tz).end) } });
  const [rows, prev, ahead] = await Promise.all([
    db.booking.findMany({ where: range(first, today), select }),
    db.booking.findMany({ where: range(prevFirst, addDays(first, -1)), select }),
    db.booking.count({ where: { businessId: business.id, status: "active", startAt: { gte: new Date(dayBounds(addDays(today, 1), tz).start) } } }),
  ]);
  return { first, today, cur: summarize(rows, first, today, tz), prev: summarize(prev, prevFirst, addDays(first, -1), tz), ahead };
}
