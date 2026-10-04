// Утренняя сводка владельцу (версия 2 плана, раздел 3): в 8:00 по времени сервиса push «Сегодня 6 записей, первая в 9:30».
// Расписание на сервере зовёт /api/cron/digest каждый час; сводка уходит тем сервисам, у кого сейчас утро и сегодня её ещё не было.
// Как и остальные уведомления, без имён и телефонов клиентов (см. push.ts).
import { db } from "./db";
import { notifyBusiness, type PushMessage } from "./push";
import { dayBounds } from "./slots";
import { hhmm, toLocal } from "./time";

/** С 8:00 до 10:00 по местному времени: если расписание пропустило час (перезапуск сервера), сводка придёт в следующий. */
export const DIGEST_FROM_MIN = 8 * 60;
export const DIGEST_UNTIL_MIN = 10 * 60;

export const plural = (n: number, one: string, few: string, many: string) =>
  n % 10 === 1 && n % 100 !== 11 ? one : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? few : many;

/** Текст сводки. Записей нет — null: «0 записей» каждое утро только раздражает. */
export function digestMessage(bookings: { startAt: Date; source: "site" | "owner" }[], tz: string): PushMessage | null {
  if (!bookings.length) return null;
  const sorted = [...bookings].sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
  const n = sorted.length;
  const time = (d: Date) => hhmm(toLocal(d.getTime(), tz).minutes).replace(/^0/, "");
  const site = sorted.filter((b) => b.source === "site").length;
  const parts = [n === 1 ? `В ${time(sorted[0].startAt)}` : `Первая в ${time(sorted[0].startAt)}, последняя в ${time(sorted[n - 1].startAt)}`];
  if (site) parts.push(site === n ? (n === 1 ? "С сайта" : "Все с сайта") : `С сайта — ${site}`);
  return { title: `Сегодня ${n} ${plural(n, "запись", "записи", "записей")}`, body: parts.join(". "), url: "/cabinet", tag: "digest" };
}

/** Разослать сводки. Повторный запуск в тот же день ничего не шлёт: дата отправки отмечается до отправки. */
export async function runDigest(now = new Date()) {
  const list = await db.business.findMany({
    where: { digestEnabled: true, status: { in: ["demo", "trial", "active"] }, pushSubs: { some: {} } },
    select: { id: true, timezone: true, digestSentOn: true },
  });
  let sent = 0;
  let empty = 0;
  for (const b of list) {
    const local = toLocal(now.getTime(), b.timezone);
    if (local.minutes < DIGEST_FROM_MIN || local.minutes >= DIGEST_UNTIL_MIN || b.digestSentOn === local.date) continue;
    // Занять сегодняшнюю сводку: если два запуска пришли одновременно, отправит только тот, чьё обновление прошло
    const claim = await db.business.updateMany({
      where: { id: b.id, OR: [{ digestSentOn: null }, { digestSentOn: { not: local.date } }] },
      data: { digestSentOn: local.date },
    });
    if (!claim.count) continue;
    const { start, end } = dayBounds(local.date, b.timezone);
    const bookings = await db.booking.findMany({
      where: { businessId: b.id, status: "active", startAt: { gte: new Date(Math.max(start, now.getTime() - 3600000)), lt: new Date(end) } },
      select: { startAt: true, source: true },
    });
    const msg = digestMessage(bookings, b.timezone);
    if (!msg) {
      empty++;
      continue;
    }
    if ((await notifyBusiness(b.id, msg)).sent) sent++;
  }
  return { checked: list.length, sent, empty };
}
