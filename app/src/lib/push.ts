// Уведомления владельцу от кабинета (Web Push, раздел 6.4 плана; Б2 проверки 4 октября).
// В уведомлении только день, время и услуга, без имени и телефона клиента: push идёт через серверы Apple и Google,
// персональные данные за рубеж не уходят. Имя и телефон владелец видит, открыв запись в кабинете.
import webpush from "web-push";
import { db } from "./db";
import { formatDayShort, hhmm, toLocal } from "./time";

export type PushMessage = { title: string; body: string; url: string; tag?: string };

type Vapid = { publicKey: string; privateKey: string };

let vapidCache: Vapid | null = null;

/** Ключи для подписи уведомлений. Создаются при первом обращении и хранятся в базе: в .env вписывать ничего не нужно. */
export async function vapidKeys(): Promise<Vapid> {
  if (vapidCache) return vapidCache;
  const row = await db.appSetting.findUnique({ where: { key: "vapid" } });
  if (row) return (vapidCache = JSON.parse(row.value) as Vapid);
  const fresh = webpush.generateVAPIDKeys();
  // Два процесса могли создать ключи одновременно: остаются те, что записались первыми
  await db.appSetting.upsert({ where: { key: "vapid" }, create: { key: "vapid", value: JSON.stringify(fresh) }, update: {} });
  const saved = await db.appSetting.findUniqueOrThrow({ where: { key: "vapid" } });
  return (vapidCache = JSON.parse(saved.value) as Vapid);
}

function subject() {
  const email = process.env.PROCESSOR_EMAIL?.trim();
  return email ? `mailto:${email}` : process.env.APP_URL || "https://avtoslot.ru";
}

/**
 * Разослать уведомление. Владелец получает всё; мастер — только записи своего поста (staffId записи);
 * userId — только устройствам этого человека (проверка). Ошибки не мешают записи: только пишутся в журнал.
 */
export async function notifyBusiness(businessId: string, msg: PushMessage, to: { staffId?: string | null; userId?: string } = {}): Promise<{ sent: number; removed: number }> {
  const who = to.userId
    ? { userId: to.userId }
    : { OR: [{ user: { role: { not: "master" as const } } }, ...(to.staffId ? [{ user: { role: "master" as const, staffId: to.staffId } }] : [])] };
  return send({ businessId, ...who }, msg);
}

/** Только мастеру поста: запись поставил или изменил владелец, ему самому слать незачем. */
export const notifyMaster = (businessId: string, staffId: string, msg: PushMessage) => send({ businessId, user: { role: "master", staffId } }, msg);

async function send(where: NonNullable<Parameters<typeof db.pushSubscription.findMany>[0]>["where"], msg: PushMessage): Promise<{ sent: number; removed: number }> {
  const subs = await db.pushSubscription.findMany({ where });
  if (!subs.length) return { sent: 0, removed: 0 };
  const keys = await vapidKeys();
  let sent = 0;
  const gone: string[] = [];
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(msg), {
          vapidDetails: { subject: subject(), publicKey: keys.publicKey, privateKey: keys.privateKey },
          TTL: 24 * 3600,
          urgency: "high",
          timeout: 10000,
        });
        sent++;
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        // Подписка больше не действует (приложение удалили, уведомления выключили) — убираем
        if (code === 404 || code === 410) gone.push(s.id);
        else console.error(`push: ${code ?? ""} ${(e as Error).message}`.trim());
      }
    }),
  );
  if (gone.length) await db.pushSubscription.deleteMany({ where: { id: { in: gone } } });
  return { sent, removed: gone.length };
}

const when = (startAt: Date, tz: string) => {
  const l = toLocal(startAt.getTime(), tz);
  const d = formatDayShort(l.date);
  return `${d.weekday}, ${d.day} ${d.month}, ${hhmm(l.minutes)}`;
};

/** «Новая запись: пт, 10 октября, 10:00» и услуга. Без имени и телефона клиента. */
/** Устройства владельца (без мастеров): для счётчиков «Телефонов с уведомлениями». */
export const ownerDevices = (businessId: string) => db.pushSubscription.count({ where: { businessId, user: { role: { not: "master" } } } });

export function newBookingMessage(b: { id: string; startAt: Date; serviceName: string }, tz: string): PushMessage {
  return { title: `Новая запись: ${when(b.startAt, tz)}`, body: b.serviceName, url: `/cabinet/b/${b.id}`, tag: `b-${b.id}` };
}

/**
 * Мастеру о записи, которую изменил владелец. Своя запись без услуги — это текст владельца, в нём бывают имя
 * и телефон клиента, поэтому её название в уведомление не идёт.
 */
export function masterMessage(kind: "new" | "moved" | "removed" | "cancelled", b: { startAt: Date; serviceId: string | null; serviceName: string }, tz: string, was?: Date): PushMessage {
  const what = b.serviceId ? b.serviceName : "Подробности в календаре";
  const title = { new: "Новая запись", moved: "Запись перенесли", removed: "Запись убрали с вашего поста", cancelled: "Запись отменили" }[kind];
  return {
    title: `${title}: ${when(b.startAt, tz)}`,
    body: kind === "moved" && was ? `${what}. Было ${when(was, tz)}` : what,
    url: `/cabinet/week?date=${toLocal(b.startAt.getTime(), tz).date}`,
  };
}

export function cancelledMessage(b: { id: string; startAt: Date; serviceName: string }, tz: string): PushMessage {
  return { title: `Клиент отменил запись: ${when(b.startAt, tz)}`, body: `${b.serviceName}. Время снова свободно`, url: `/cabinet/b/${b.id}`, tag: `b-${b.id}` };
}

// Адреса подписки выдают только службы уведомлений браузеров. Любой другой адрес не принимаем:
// иначе сервер по команде из кабинета слал бы запросы куда угодно
const PUSH_HOSTS = [/(^|\.)googleapis\.com$/, /(^|\.)push\.apple\.com$/, /(^|\.)push\.services\.mozilla\.com$/, /(^|\.)notify\.windows\.com$/, /(^|\.)yandex\.(ru|net)$/];
export const pushHostOk = (u: string) => {
  try {
    const url = new URL(u);
    // Только обычное имя хоста без порта и логина: библиотека отправки разбирает адрес по-своему,
    // и «https://чужой.сайт;.fcm.googleapis.com» иначе прошёл бы проверку, а запрос ушёл бы на чужой сайт
    return url.protocol === "https:" && /^[a-z0-9.-]+$/.test(url.hostname) && !url.port && !url.username && !url.password && PUSH_HOSTS.some((r) => r.test(url.hostname));
  } catch {
    return false;
  }
};
