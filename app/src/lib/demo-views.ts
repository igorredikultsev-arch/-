// Отметки «владелец открыл демо»: кто посмотрел ссылку из сообщения, сколько раз и когда.
// Пишет их сама страница демо после загрузки (`/api/s/<slug>/view`), поэтому превью ссылки в мессенджерах,
// которые страницу только скачивают, не считаются. Хранится только время и телефон это или компьютер.
import { db } from "./db";
import { isExampleSlug } from "./business";
import { formatDate, hhmm, toLocal } from "./time";

export type ViewKind = "open" | "style";
export const isViewKind = (k: unknown): k is ViewKind => k === "open" || k === "style";

/**
 * Роботы и превью ссылок (TelegramBot, vkShare, WhatsApp, поисковики): их открытия не считаем.
 * Встроенные браузеры приложений («Telegram-Android», «VKAndroidApp», «YandexSearch») — это люди, их считаем.
 */
const BOT = /bot\b|bot\/|crawl|spider|slurp|vkshare|facebookexternalhit|whatsapp|headless|lighthouse|python|curl|wget|node-fetch|axios/i;
export const isBotUa = (ua: string) => !ua || BOT.test(ua);

export const deviceOf = (ua: string): "phone" | "desktop" => (/mobi|android|iphone|ipad|ipod/i.test(ua) ? "phone" : "desktop");

/**
 * Записать открытие. Не считаем: не демо, пример с главной, роботов и администратора
 * (Игорь проверяет демо перед отправкой, это не владелец).
 */
export async function recordDemoView(
  biz: { id: string; slug: string; status: string },
  opts: { kind: ViewKind; ua: string; admin: boolean; now?: Date },
): Promise<boolean> {
  if (biz.status !== "demo" || isExampleSlug(biz.slug) || opts.admin || isBotUa(opts.ua)) return false;
  await db.demoView.create({ data: { businessId: biz.id, kind: opts.kind, device: deviceOf(opts.ua), at: opts.now ?? new Date() } });
  return true;
}

export type ViewSummary = { opens: number; styles: number; first: Date; last: Date; phone: boolean; desktop: boolean };

/** Сводка по сервисам: сколько раз открыли, первый и последний раз, с чего смотрели. */
export async function viewSummaries(businessIds: string[]): Promise<Map<string, ViewSummary>> {
  const out = new Map<string, ViewSummary>();
  if (!businessIds.length) return out;
  const rows = await db.demoView.groupBy({
    by: ["businessId", "kind", "device"],
    where: { businessId: { in: businessIds } },
    _count: true,
    _min: { at: true },
    _max: { at: true },
  });
  for (const r of rows) {
    const s = out.get(r.businessId) ?? { opens: 0, styles: 0, first: r._min.at!, last: r._max.at!, phone: false, desktop: false };
    if (r.kind === "open") s.opens += r._count;
    else s.styles += r._count;
    if (r._min.at! < s.first) s.first = r._min.at!;
    if (r._max.at! > s.last) s.last = r._max.at!;
    if (r.device === "phone") s.phone = true;
    else s.desktop = true;
    out.set(r.businessId, s);
  }
  return out;
}

/** Время в админке — по Перми, где работает Игорь. */
const ADMIN_TZ = "Asia/Yekaterinburg";

/** «сегодня в 14:05», «вчера в 9:30», «7 октября в 18:00» */
export function whenText(d: Date, nowMs = Date.now()): string {
  const l = toLocal(d.getTime(), ADMIN_TZ);
  const today = toLocal(nowMs, ADMIN_TZ).date;
  const yesterday = toLocal(nowMs - 86400000, ADMIN_TZ).date;
  const day = l.date === today ? "сегодня" : l.date === yesterday ? "вчера" : formatDate(d.getTime(), ADMIN_TZ);
  return `${day} в ${hhmm(l.minutes)}`;
}

/** «1 раз», «3 раза», «5 раз» */
export function timesText(n: number) {
  const n10 = n % 10, n100 = n % 100;
  return `${n} ${n10 >= 2 && n10 <= 4 && (n100 < 12 || n100 > 14) ? "раза" : "раз"}`;
}

/** «3 раза, последний раз сегодня в 14:05» */
export const summaryText = (s: ViewSummary, nowMs = Date.now()) =>
  s.opens > 0 ? `${timesText(s.opens)}, последний раз ${whenText(s.last, nowMs)}` : `смотрели стили, ${whenText(s.last, nowMs)}`;

export const deviceText = (s: Pick<ViewSummary, "phone" | "desktop">) =>
  s.phone && s.desktop ? "с телефона и компьютера" : s.phone ? "с телефона" : "с компьютера";

/** Открыли недавно: стоит написать сейчас, пока владелец помнит сайт. */
export const HOT_HOURS = 48;
export const isHot = (s: ViewSummary | undefined, nowMs = Date.now()) => !!s && nowMs - s.last.getTime() < HOT_HOURS * 3600000;
