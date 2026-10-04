import { RETENTION_YEARS } from "./legal";
import { UNPAID_GRACE_DAYS } from "./pricing";
import { db } from "./db";

/** Сколько хранится архивное демо (карточка лида с контактами), считая от конца демо. */
export const DEMO_KEEP_DAYS = 365;

/**
 * Регулярная очистка:
 * 1) демо, которые не подключили за 14 дней (раздел 2.3, п. 5): в архив, а не удаление,
 *    чтобы в воронке осталась карточка лида (этап, контакт, заметки). Пробные записи демо удаляются.
 *    Через 12 месяцев архивные демо, так и не ставшие клиентами, удаляются вместе с контактами (политика /privacy, п. 4);
 * 2) не оплатили через UNPAID_GRACE_DAYS дней после конца оплаченного срока — сайт приостанавливается (оферта, п. 4.1);
 *    возобновляет его оплата в админке;
 * 3) персональные данные клиентов старше срока хранения (раздел 6.3, п. 5);
 * 4) просроченные сессии и счётчики лимитов.
 */
export async function runCleanup(now = new Date()) {
  const expired = await db.business.findMany({ where: { status: "demo", demoExpiresAt: { lt: now } }, select: { id: true } });
  const ids = expired.map((b) => b.id);
  if (ids.length) {
    await db.booking.deleteMany({ where: { businessId: { in: ids } } });
    await db.business.updateMany({ where: { id: { in: ids } }, data: { status: "archived" } });
  }
  const yearAgo = new Date(now.getTime() - DEMO_KEEP_DAYS * 86400000);
  const old = await db.business.deleteMany({
    where: { status: "archived", demoExpiresAt: { lt: yearAgo }, users: { none: {} }, payments: { none: {} } },
  });
  const graceAgo = new Date(now.getTime() - UNPAID_GRACE_DAYS * 86400000);
  const unpaid = await db.business.updateMany({
    where: { OR: [{ status: "active", paidUntil: { lt: graceAgo } }, { status: "trial", trialEndsAt: { lt: graceAgo }, paidUntil: null }] },
    data: { status: "suspended" },
  });
  const cutoff = new Date(now);
  cutoff.setFullYear(cutoff.getFullYear() - RETENTION_YEARS);
  const pd = await db.booking.updateMany({
    where: { startAt: { lt: cutoff }, OR: [{ clientName: { not: null } }, { clientPhone: { not: null } }, { car: { not: null } }, { comment: { not: null } }] },
    data: { clientName: null, clientPhone: null, car: null, comment: null, consentIp: null },
  });
  const sessions = await db.session.deleteMany({ where: { expiresAt: { lt: now } } });
  const limits = await db.rateLimit.deleteMany({ where: { windowStart: { lt: new Date(now.getTime() - 86400000) } } });
  return { demosArchived: ids.length, demosDeleted: old.count, suspendedUnpaid: unpaid.count, bookingsAnonymized: pd.count, sessionsDeleted: sessions.count, limitsDeleted: limits.count };
}
