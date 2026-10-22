// Сотрудники сервиса: к кому ставить запись.
import type { Prisma } from "@prisma/client";
import { OCCUPYING } from "./booking-status";

/**
 * Первый сотрудник нужного вида (стенд или пост), у которого в это время нет записи. null — сотрудников нет
 * или все заняты (владелец записал сверх, это его решение): запись тогда без сотрудника, календарь разложит её сам.
 */
export async function freeStaff(tx: Prisma.TransactionClient, businessId: string, onStand: boolean, start: Date, end: Date, standPosts: number): Promise<string | null> {
  const staff = await tx.staff.findMany({ where: { businessId }, orderBy: [{ sortOrder: "asc" }, { id: "asc" }], select: { id: true, onStand: true } });
  const kind = standPosts > 0 ? staff.filter((s) => s.onStand === onStand) : staff.filter((s) => !s.onStand);
  if (!kind.length) return null;
  const busy = await tx.booking.findMany({
    where: { businessId, staffId: { in: kind.map((s) => s.id) }, status: { in: [...OCCUPYING] }, startAt: { lt: end }, endAt: { gt: start } },
    select: { staffId: true },
  });
  const taken = new Set(busy.map((b) => b.staffId));
  return kind.find((s) => !taken.has(s.id))?.id ?? null;
}
