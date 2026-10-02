// Запись: расчёт окон по данным из базы и создание записи без двойного бронирования (раздел 4.3).
import type { Prisma, PrismaClient } from "@prisma/client";
import { db } from "./db";
import { dayBounds, daySlots, horizonDates, inHorizon, peakLoad, resolveDayWindow, type Interval, type Slot } from "./slots";
import { newToken } from "./tokens";
import { localToUtc, toLocal } from "./time";

type Tx = Prisma.TransactionClient | PrismaClient;

export const CONSENT_VERSION = "2026-10-v1";

export class BookingError extends Error {
  constructor(
    public code: "slot_taken" | "bad_slot" | "not_found" | "closed" | "too_late" | "already_cancelled",
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
      where: { businessId, status: "active", startAt: { lt: to }, endAt: { gt: from } },
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
  hours: { weekday: number; closed: boolean; openMin: number; closeMin: number }[];
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
};

/** Запись с сайта. Окно перепроверяется под блокировкой: если его успели занять — ошибка slot_taken. */
export async function createSiteBooking(input: SiteBookingInput) {
  const nowMs = input.nowMs ?? Date.now();
  return db.$transaction(async (tx) => {
    await lockBusiness(tx, input.businessId);
    const biz = await tx.business.findUnique({ where: { id: input.businessId }, select: businessForSlotsSelect });
    const service = await tx.service.findFirst({ where: { id: input.serviceId, businessId: input.businessId, active: true } });
    if (!biz || !service) throw new BookingError("not_found", "Сервис или услуга не найдены");
    const slots = await getDaySlots(biz, input.date, service.durationMin, nowMs, tx);
    const slot = slots.find((s) => s.time === input.time);
    if (!slot) throw new BookingError("bad_slot", "Такого времени нет в расписании");
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
        clientName: input.clientName,
        clientPhone: input.clientPhone,
        car: input.car,
        comment: input.comment || null,
        cancelToken: newToken(),
        consentVersion: CONSENT_VERSION,
        consentAt: new Date(nowMs),
        consentIp: input.consentIp ?? null,
      },
    });
  });
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
export async function createOwnerBooking(input: OwnerBookingInput) {
  return db.$transaction(async (tx) => {
    await lockBusiness(tx, input.businessId);
    const biz = await tx.business.findUnique({ where: { id: input.businessId } });
    const service = await tx.service.findFirst({ where: { id: input.serviceId, businessId: input.businessId } });
    if (!biz || !service) throw new BookingError("not_found", "Услуга не найдена");
    const start = localToUtc(input.date, input.startMin, biz.timezone);
    const slot = { start, end: start + service.durationMin * 60000 };
    const occ = await loadDay(tx, biz.id, input.date, biz.timezone);
    const allClosed = occ.blocksAll.some((b) => b.start < slot.end && slot.start < b.end);
    const load = peakLoad(slot, [...occ.bookings, ...occ.blocksOnePost]);
    const overbooked = allClosed || load >= biz.posts;
    if (overbooked && !input.force) {
      return { booking: null, warning: { load, posts: biz.posts, allClosed } };
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
  });
}

/** Можно ли клиенту ещё отменить запись онлайн (раздел 2.1, п. 9). */
export function canClientCancel(startAt: Date, cancelHours: number, nowMs = Date.now()) {
  return startAt.getTime() - nowMs >= cancelHours * 3600000;
}

export async function cancelByClient(token: string, nowMs = Date.now()) {
  const b = await db.booking.findUnique({ where: { cancelToken: token }, include: { business: true } });
  if (!b) throw new BookingError("not_found", "Запись не найдена");
  if (b.status !== "active") throw new BookingError("already_cancelled", "Запись уже отменена");
  if (!canClientCancel(b.startAt, b.business.cancelHours, nowMs)) {
    throw new BookingError("too_late", "Отменить онлайн уже нельзя. Позвоните в сервис");
  }
  return db.booking.update({
    where: { id: b.id },
    data: { status: "cancelled", cancelledAt: new Date(nowMs), cancelledBy: "client" },
  });
}

/** Утилита для экранов: местная дата и минуты начала записи. */
export function bookingLocal(startAt: Date, tz: string) {
  return toLocal(startAt.getTime(), tz);
}
