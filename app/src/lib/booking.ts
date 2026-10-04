// Запись: расчёт окон по данным из базы и создание записи без двойного бронирования (раздел 4.3).
import type { Prisma, PrismaClient } from "@prisma/client";
import { db } from "./db";
import { breakIntervals, dayBounds, dayLanes, daySlots, fullBusy, horizonDates, inHorizon, peakLoad, resolveDayWindow, type Interval, type LaneSpan, type Slot } from "./slots";
import { newToken } from "./tokens";
import { localToUtc, toLocal } from "./time";

type Tx = Prisma.TransactionClient | PrismaClient;

export const CONSENT_VERSION = "2026-10-v1";

/** Записи, которые занимают пост: активные и уже выполненные (отмена и «не приехал» время освобождают). */
export const OCCUPYING = ["active", "done"] as const;

/** Сколько ждать очереди к базе при наплыве записей, прежде чем ответить «попробуйте ещё раз». */
const TX_OPTIONS = { maxWait: 10000, timeout: 15000 };

export class BookingError extends Error {
  constructor(
    public code: "slot_taken" | "bad_slot" | "not_found" | "closed" | "too_late" | "already_cancelled" | "too_many" | "no_shows",
    message: string,
  ) {
    super(message);
  }
}

/** Блокировка на уровне сервиса до конца транзакции: записи в один сервис идут строго по очереди. */
async function lockBusiness(tx: Tx, businessId: string) {
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${businessId}))::text AS locked`;
}

async function loadDay(tx: Tx, businessId: string, date: string, tz: string) {
  return loadRange(tx, businessId, date, date, tz);
}

async function loadRange(tx: Tx, businessId: string, firstDate: string, lastDate: string, tz: string) {
  // Берём с запасом в сутки: длинная запись или закрытие могут начаться накануне
  const from = new Date(dayBounds(firstDate, tz).start - 86400000);
  const to = new Date(dayBounds(lastDate, tz).end + 86400000);
  const [bookings, blocks] = await Promise.all([
    tx.booking.findMany({
      where: { businessId, status: { in: [...OCCUPYING] }, startAt: { lt: to }, endAt: { gt: from } },
      select: { startAt: true, endAt: true },
    }),
    tx.block.findMany({
      where: { businessId, startAt: { lt: to }, endAt: { gt: from } },
      select: { startAt: true, endAt: true, scope: true },
    }),
  ]);
  const iv = (r: { startAt: Date; endAt: Date }): Interval => ({ start: r.startAt.getTime(), end: r.endAt.getTime() });
  return {
    bookings: bookings.map(iv),
    blocksAll: blocks.filter((b) => b.scope === "all").map(iv),
    blocksOnePost: blocks.filter((b) => b.scope === "one_post").map(iv),
  };
}

type BusinessForSlots = {
  id: string;
  timezone: string;
  posts: number;
  slotStepMin: number;
  minLeadMin: number;
  horizonDays: number;
  hours: { weekday: number; closed: boolean; openMin: number; closeMin: number; breakFromMin: number | null; breakToMin: number | null }[];
  exceptions: { date: string; closed: boolean; openMin: number | null; closeMin: number | null }[];
};

export const businessForSlotsSelect = {
  id: true,
  timezone: true,
  posts: true,
  slotStepMin: true,
  minLeadMin: true,
  horizonDays: true,
  hours: true,
  exceptions: true,
} satisfies Prisma.BusinessSelect;

export async function getDaySlots(
  biz: BusinessForSlots,
  date: string,
  durationMin: number,
  nowMs = Date.now(),
  tx: Tx = db,
): Promise<Slot[]> {
  if (!inHorizon(date, nowMs, biz.timezone, biz.horizonDays)) return [];
  const window = resolveDayWindow(date, biz.hours, biz.exceptions);
  if (!window) return [];
  const occ = await loadDay(tx, biz.id, date, biz.timezone);
  return daySlots({
    date,
    tz: biz.timezone,
    window,
    durationMin,
    stepMin: biz.slotStepMin,
    posts: biz.posts,
    ...occ,
    nowMs,
    minLeadMin: biz.minLeadMin,
  });
}

export type DayLoad = { date: string; open: number; close: number; now: number | null; busy: LaneSpan[] } | null;

/** Когда сервис занят целиком (все посты), для витрины сайта («План», «Такси»). null — выходной или вне горизонта. */
export async function getDayLoad(biz: BusinessForSlots, date: string, nowMs = Date.now()): Promise<DayLoad> {
  if (!inHorizon(date, nowMs, biz.timezone, biz.horizonDays)) return null;
  const window = resolveDayWindow(date, biz.hours, biz.exceptions);
  if (!window) return null;
  const occ = await loadDay(db, biz.id, date, biz.timezone);
  const local = toLocal(nowMs, biz.timezone);
  const day = dayLanes({ date, tz: biz.timezone, window, posts: biz.posts, ...occ });
  return { date, open: day.open, close: day.close, busy: fullBusy(day.lanes), now: local.date === date ? local.minutes : null };
}

export type DaySummary = { date: string; closed: boolean; free: number };

/** Сводка по дням горизонта для полоски дат: выходной или сколько свободных окон. Один запрос к базе. */
export async function getHorizonSummary(biz: BusinessForSlots, durationMin: number, nowMs = Date.now()): Promise<DaySummary[]> {
  const dates = horizonDates(nowMs, biz.timezone, biz.horizonDays);
  const occ = await loadRange(db, biz.id, dates[0], dates[dates.length - 1], biz.timezone);
  return dates.map((date) => {
    const window = resolveDayWindow(date, biz.hours, biz.exceptions);
    if (!window) return { date, closed: true, free: 0 };
    const slots = daySlots({
      date, tz: biz.timezone, window, durationMin, stepMin: biz.slotStepMin, posts: biz.posts,
      ...occ, nowMs, minLeadMin: biz.minLeadMin,
    });
    return { date, closed: false, free: slots.filter((s) => s.free).length };
  });
}

export type SiteBookingInput = {
  businessId: string;
  serviceId: string;
  date: string;
  time: string; // «HH:MM» по местному времени
  clientName: string;
  clientPhone: string;
  car: string;
  comment?: string;
  consentIp?: string;
  nowMs?: number;
  /** Не больше стольких будущих записей на один номер (проверяется под той же блокировкой). */
  maxActivePerPhone?: number;
  /** Демо: время занимается как обычно, но имя, телефон, машина и комментарий не сохраняются (сервис ещё не наш клиент). */
  withoutPersonalData?: boolean;
};

/** Сколько неявок за год закрывают онлайн-запись с номера. */
export const NO_SHOW_LIMIT = 2;

/** Неявки клиента в этом сервисе за последний год. */
export function noShowCount(tx: Prisma.TransactionClient | typeof db, businessId: string, phone: string, nowMs = Date.now()) {
  return tx.booking.count({
    where: { businessId, clientPhone: phone, status: "no_show", startAt: { gt: new Date(nowMs - 365 * 86400000) } },
  });
}

/** Запись с сайта. Окно перепроверяется под блокировкой: если его успели занять — ошибка slot_taken. */
export async function createSiteBooking(input: SiteBookingInput) {
  const nowMs = input.nowMs ?? Date.now();
  return db.$transaction(async (tx) => {
    await lockBusiness(tx, input.businessId);
    const biz = await tx.business.findUnique({ where: { id: input.businessId }, select: businessForSlotsSelect });
    const service = await tx.service.findFirst({ where: { id: input.serviceId, businessId: input.businessId, active: true } });
    if (!biz || !service) throw new BookingError("not_found", "Сервис или услуга не найдены");
    const pd = !input.withoutPersonalData;
    if (pd && input.maxActivePerPhone) {
      const active = await tx.booking.count({
        where: { businessId: input.businessId, clientPhone: input.clientPhone, status: "active", startAt: { gt: new Date(nowMs) } },
      });
      if (active >= input.maxActivePerPhone) {
        throw new BookingError("too_many", "На этот номер уже есть запись в этом сервисе. Чтобы записать ещё одну машину, позвоните в сервис");
      }
    }
    // Дважды за год не приехал — онлайн запись с этого номера закрыта, записаться можно по телефону.
    // Владелец снимает запрет, поменяв отметку «Не приехал» у прошлой записи
    if (pd && (await noShowCount(tx, input.businessId, input.clientPhone, nowMs)) >= NO_SHOW_LIMIT) {
      throw new BookingError("no_shows", "Онлайн-запись с этого номера недоступна. Позвоните в сервис, вас запишут по телефону");
    }
    const slots = await getDaySlots(biz, input.date, service.durationMin, nowMs, tx);
    const slot = slots.find((s) => s.time === input.time);
    // Чаще всего время просто прошло (или ушло за «запас до записи»), пока клиент заполнял форму
    if (!slot) throw new BookingError("bad_slot", "Это время уже недоступно. Выберите другое");
    if (!slot.free) throw new BookingError("slot_taken", "Это время только что заняли. Выберите другое");
    return tx.booking.create({
      data: {
        businessId: input.businessId,
        serviceId: service.id,
        serviceName: service.name,
        priceFrom: service.priceFrom,
        startAt: new Date(slot.start),
        endAt: new Date(slot.end),
        source: "site",
        clientName: pd ? input.clientName : null,
        clientPhone: pd ? input.clientPhone : null,
        car: pd ? input.car : null,
        comment: pd ? input.comment || null : null,
        cancelToken: newToken(),
        consentVersion: pd ? CONSENT_VERSION : null,
        consentAt: pd ? new Date(nowMs) : null,
        consentIp: pd ? (input.consentIp ?? null) : null,
      },
    });
  }, TX_OPTIONS);
}

export type OwnerBookingInput = {
  businessId: string;
  serviceId: string;
  date: string;
  startMin: number;
  clientName?: string;
  clientPhone?: string;
  car?: string;
  comment?: string;
  force?: boolean; // записать, даже если все посты заняты
};

/**
 * Запись, которую владелец вносит сам после звонка (раздел 4.4).
 * Может превышать число постов, но только после явного подтверждения (force).
 */
export type OwnerWarning = { load: number; posts: number; allClosed: boolean; outside: boolean };

/** Пересекается ли интервал с часами работы, обедом, закрытым временем и другими записями. */
async function checkCapacity(tx: Tx, biz: BusinessForSlots, date: string, slot: Interval, ignoreBookingId?: string): Promise<OwnerWarning | null> {
  const window = resolveDayWindow(date, biz.hours, biz.exceptions);
  const dayStart = localToUtc(date, 0, biz.timezone);
  const outside = !window || slot.start < dayStart + window.openMin * 60000 || slot.end > dayStart + window.closeMin * 60000;
  const occ = await loadDay(tx, biz.id, date, biz.timezone);
  let bookings = occ.bookings;
  if (ignoreBookingId) {
    const self = await tx.booking.findUnique({ where: { id: ignoreBookingId }, select: { startAt: true, endAt: true, status: true } });
    if (self && (OCCUPYING as readonly string[]).includes(self.status)) {
      const i = bookings.findIndex((b) => b.start === self.startAt.getTime() && b.end === self.endAt.getTime());
      if (i >= 0) bookings = bookings.filter((_, k) => k !== i);
    }
  }
  const closed = [...occ.blocksAll, ...breakIntervals(date, biz.timezone, window)];
  const allClosed = closed.some((b) => b.start < slot.end && slot.start < b.end);
  const load = peakLoad(slot, [...bookings, ...occ.blocksOnePost]);
  return outside || allClosed || load >= biz.posts ? { load, posts: biz.posts, allClosed, outside } : null;
}

export async function createOwnerBooking(input: OwnerBookingInput) {
  return db.$transaction(async (tx) => {
    await lockBusiness(tx, input.businessId);
    const biz = await tx.business.findUnique({ where: { id: input.businessId }, select: businessForSlotsSelect });
    const service = await tx.service.findFirst({ where: { id: input.serviceId, businessId: input.businessId } });
    if (!biz || !service) throw new BookingError("not_found", "Услуга не найдена");
    const start = localToUtc(input.date, input.startMin, biz.timezone);
    const slot = { start, end: start + service.durationMin * 60000 };
    const warning = await checkCapacity(tx, biz, input.date, slot);
    if (warning && !input.force) {
      return { booking: null, warning };
    }
    const booking = await tx.booking.create({
      data: {
        businessId: biz.id,
        serviceId: service.id,
        serviceName: service.name,
        priceFrom: service.priceFrom,
        startAt: new Date(slot.start),
        endAt: new Date(slot.end),
        source: "owner",
        clientName: input.clientName || null,
        clientPhone: input.clientPhone || null,
        car: input.car || null,
        comment: input.comment || null,
        cancelToken: newToken(),
      },
    });
    return { booking, warning: null };
  }, TX_OPTIONS);
}

/**
 * Владелец возвращает отменённую запись в активные. Время могли уже занять, поэтому проверяем посты
 * под той же блокировкой, что и при записи, и без подтверждения (force) не возвращаем.
 */
export async function restoreBooking(id: string, businessId: string, force = false) {
  return db.$transaction(async (tx) => {
    await lockBusiness(tx, businessId);
    const b = await tx.booking.findFirst({ where: { id, businessId } });
    const biz = await tx.business.findUnique({ where: { id: businessId }, select: businessForSlotsSelect });
    if (!b || !biz) throw new BookingError("not_found", "Запись не найдена");
    const date = toLocal(b.startAt.getTime(), biz.timezone).date;
    const warning = await checkCapacity(tx, biz, date, { start: b.startAt.getTime(), end: b.endAt.getTime() }, id);
    if (warning && !force) return { ok: false as const, warning };
    await tx.booking.update({ where: { id }, data: { status: "active", cancelledAt: null, cancelledBy: null } });
    return { ok: true as const, warning: null };
  }, TX_OPTIONS);
}

/** Активные записи, которые попадают в интервал: для предупреждения при закрытии времени и праздниках. */
export async function bookingsInRange(businessId: string, start: number, end: number) {
  return db.booking.findMany({
    where: { businessId, status: "active", startAt: { lt: new Date(end) }, endAt: { gt: new Date(start) } },
    orderBy: { startAt: "asc" },
    select: { id: true, startAt: true, clientName: true, clientPhone: true, serviceName: true },
  });
}

/** Можно ли клиенту ещё отменить запись онлайн (раздел 2.1, п. 9). */
export function canClientCancel(startAt: Date, cancelHours: number, nowMs = Date.now()) {
  return startAt.getTime() - nowMs >= cancelHours * 3600000;
}

const NOT_ACTIVE: Record<string, string> = {
  cancelled: "Запись уже отменена",
  done: "Эта запись уже выполнена",
  no_show: "Эта запись уже закрыта сервисом",
};

export async function cancelByClient(token: string, nowMs = Date.now()) {
  const b = await db.booking.findUnique({ where: { cancelToken: token }, include: { business: true } });
  if (!b) throw new BookingError("not_found", "Запись не найдена");
  if (b.status !== "active") throw new BookingError("already_cancelled", NOT_ACTIVE[b.status] ?? "Запись уже отменена");
  if (!canClientCancel(b.startAt, b.business.cancelHours, nowMs)) {
    throw new BookingError("too_late", "Отменить онлайн уже нельзя. Позвоните в сервис");
  }
  // Условие на статус в самом обновлении: если владелец в ту же секунду поменял статус, его отметка не затрётся
  const r = await db.booking.updateMany({
    where: { id: b.id, status: "active" },
    data: { status: "cancelled", cancelledAt: new Date(nowMs), cancelledBy: "client" },
  });
  if (r.count === 0) throw new BookingError("already_cancelled", "Запись уже изменена. Обновите страницу");
  return { ...b, status: "cancelled" as const };
}

/** Утилита для экранов: местная дата и минуты начала записи. */
export function bookingLocal(startAt: Date, tz: string) {
  return toLocal(startAt.getTime(), tz);
}
