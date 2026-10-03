import { RETENTION_YEARS } from "./legal";
import { db } from "./db";

/**
 * Регулярная очистка:
 * 1) демо, которые не перевели в пробный период за 14 дней (раздел 2.3, п. 5): в архив, а не удаление,
 *    чтобы в воронке осталась карточка лида (этап, контакт, заметки). Пробные записи демо удаляются;
 * 2) персональные данные клиентов старше срока хранения (раздел 6.3, п. 5);
 * 3) просроченные сессии и счётчики лимитов.
 */
export async function runCleanup(now = new Date()) {
  const expired = await db.business.findMany({ where: { status: "demo", demoExpiresAt: { lt: now } }, select: { id: true } });
  const ids = expired.map((b) => b.id);
  if (ids.length) {
    await db.booking.deleteMany({ where: { businessId: { in: ids } } });
    await db.business.updateMany({ where: { id: { in: ids } }, data: { status: "archived" } });
  }
  const cutoff = new Date(now);
  cutoff.setFullYear(cutoff.getFullYear() - RETENTION_YEARS);
  const pd = await db.booking.updateMany({
    where: { startAt: { lt: cutoff }, OR: [{ clientName: { not: null } }, { clientPhone: { not: null } }, { car: { not: null } }, { comment: { not: null } }] },
    data: { clientName: null, clientPhone: null, car: null, comment: null, consentIp: null },
  });
  const sessions = await db.session.deleteMany({ where: { expiresAt: { lt: now } } });
  const limits = await db.rateLimit.deleteMany({ where: { windowStart: { lt: new Date(now.getTime() - 86400000) } } });
  return { demosArchived: ids.length, bookingsAnonymized: pd.count, sessionsDeleted: sessions.count, limitsDeleted: limits.count };
}
