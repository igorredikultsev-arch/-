// Сотрудники сервиса: к кому ставить запись.
import type { Prisma } from "@prisma/client";
import { OCCUPYING } from "./booking-status";
import { calendarLanes } from "./calendar";
import { db } from "./db";

/**
 * Первый сотрудник нужного вида (стенд или пост), у которого в это время нет записи. null — сотрудников нет
 * или все заняты (владелец записал сверх, это его решение): запись тогда без сотрудника, календарь разложит её сам.
 */
export async function freeStaff(tx: Prisma.TransactionClient, businessId: string, onStand: boolean, start: Date, end: Date, standPosts: number, ignoreId?: string): Promise<string | null> {
  const staff = await tx.staff.findMany({ where: { businessId }, orderBy: [{ sortOrder: "asc" }, { id: "asc" }], select: { id: true, onStand: true } });
  const all = standPosts > 0 ? staff.filter((s) => s.onStand === onStand) : staff.filter((s) => !s.onStand);
  if (!all.length) return null;
  // Посты, за которыми закреплены услуги (шиномонтаж — «Пост 1»), занимаем последними: остальные услуги идут на любой пост,
  // но первыми на свободные другие, чтобы не отнимать закреплённый пост
  const pinned = new Set((await tx.service.findMany({ where: { businessId, staffId: { not: null } }, select: { staffId: true } })).map((s) => s.staffId));
  const kind = [...all.filter((s) => !pinned.has(s.id)), ...all.filter((s) => pinned.has(s.id))];
  const busy = await tx.booking.findMany({
    where: { businessId, staffId: { in: kind.map((s) => s.id) }, ...(ignoreId ? { id: { not: ignoreId } } : {}), status: { in: [...OCCUPYING] }, startAt: { lt: end }, endAt: { gt: start } },
    select: { staffId: true },
  });
  const taken = new Set(busy.map((b) => b.staffId));
  return kind.find((s) => !taken.has(s.id))?.id ?? null;
}

/**
 * Колонки календаря как записи в базе: если у сервиса ещё нет ни одной, создаёт «Пост 1…N» и «Стенд развала»
 * по правилам записи. Тогда пост можно выбрать в записи, переименовать и перекрасить, как сотрудника.
 */
export async function ensureStaff(business: { id: string; posts: number; standPosts: number }) {
  await db.$transaction(async (tx) => {
    // Два открытых кабинета одновременно не создадут колонки дважды
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${business.id}))::text AS locked`;
    if (await tx.staff.count({ where: { businessId: business.id } })) return;
    const lanes = calendarLanes([], business.posts, business.standPosts);
    await tx.staff.createMany({ data: lanes.map((l, i) => ({ businessId: business.id, name: l.name, color: l.color, onStand: l.onStand, sortOrder: i })) });
  });
}
