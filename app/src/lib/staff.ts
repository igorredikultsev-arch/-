// Сотрудники сервиса: к кому ставить запись.
import type { Prisma } from "@prisma/client";
import { OCCUPYING } from "./booking-status";
import { calendarLanes } from "./calendar";
import { db } from "./db";

/**
 * Первый сотрудник нужного вида (стенд или пост), у которого в это время нет записи и который не закрыт. null — сотрудников нет
 * или все заняты (владелец записал сверх, это его решение): запись тогда без сотрудника, календарь разложит её сам.
 * only — мастера услуги (двигатель — Ромашов или Шарапов): выбираем из них, а если все заняты — первого из них.
 */
export async function freeStaff(
  tx: Prisma.TransactionClient, businessId: string, onStand: boolean, start: Date, end: Date, standPosts: number,
  opts: { only?: string[]; ignoreId?: string } = {},
): Promise<string | null> {
  const only = onStand ? [] : (opts.only ?? []);
  const staff = await tx.staff.findMany({
    where: { businessId, ...(only.length ? { id: { in: only } } : {}) },
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    select: { id: true, onStand: true, _count: { select: { services: true } } },
  });
  const all = only.length ? staff : standPosts > 0 ? staff.filter((s) => s.onStand === onStand) : staff.filter((s) => !s.onStand);
  if (!all.length) return null;
  // Посты, за которыми закреплены услуги (шиномонтаж — «Пост 1»), занимаем последними: остальные услуги идут на любой пост,
  // но первыми на свободные другие, чтобы не отнимать закреплённый пост
  const kind = [...all.filter((s) => !s._count.services), ...all.filter((s) => s._count.services)];
  const ids = kind.map((s) => s.id);
  const [busy, away] = await Promise.all([
    tx.booking.findMany({
      where: { businessId, staffId: { in: ids }, ...(opts.ignoreId ? { id: { not: opts.ignoreId } } : {}), status: { in: [...OCCUPYING] }, startAt: { lt: end }, endAt: { gt: start } },
      select: { staffId: true },
    }),
    tx.block.findMany({ where: { businessId, staffId: { in: ids }, startAt: { lt: end }, endAt: { gt: start } }, select: { staffId: true } }),
  ]);
  const taken = new Set([...busy, ...away].map((b) => b.staffId));
  return kind.find((s) => !taken.has(s.id))?.id ?? (only.length ? kind[0].id : null);
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
