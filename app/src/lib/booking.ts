// Запись: расчёт окон по данным из базы и создание записи без двойного бронирования (раздел 4.3).
import type { Prisma, PrismaClient } from "@prisma/client";
import { db } from "./db";
import { breakIntervals, dayBounds, dayLanes, daySlots, fullBusy, horizonDates, inHorizon, peakLoad, resolveDayWindow, splitStand, unionSpans, type Busy, type Interval, type LaneSpan, type Slot } from "./slots";
import { OCCUPYING } from "./booking-status";
import { freeStaff } from "./staff";
import { newToken } from "./tokens";
import { localToUtc, toLocal } from "./time";

type Tx = Prisma.TransactionClient | PrismaClient;

export const CONSENT_VERSION = "2026-10-v3"; // v3: состав данных, напоминания, история для претензий, «уничтожаются» (юр. проверка 5 октября)

/** Записи, которые занимают пост: активные и уже выполненные (отмена и «не приехал» время освобождают). */
export { OCCUPYING };

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
      // Нижняя граница по началу: без неё запрос перебирал бы всю историю записей сервиса. Запись не длиннее 10 часов,
      // закрытие — не длиннее суток, а from уже взят с запасом в сутки, поэтому ничего пересекающееся не теряется
      where: { businessId, status: { in: [...OCCUPYING] }, startAt: { gte: from, lt: to }, endAt: { gt: from } },
      select: { startAt: true, endAt: true, source: true, onStand: true, staffId: true },
    }),
    tx.block.findMany({
      where: { businessId, startAt: { gte: from, lt: to }, endAt: { gt: from } },
      select: { startAt: true, endAt: true, scope: true },
    }),
  ]);
  const iv = (r: { startAt: Date; endAt: Date }): Interval => ({ start: r.startAt.getTime(), end: r.endAt.getTime() });
  const busy = (r: { startAt: Date; endAt: Date; onStand: boolean }): Busy => ({ ...iv(r), stand: r.onStand });
  return {
    bookings: bookings.map(busy),
    siteBookings: bookings.filter((b) => b.source === "site").map(busy),
    blocksAll: blocks.filter((b) => b.scope === "all").map(iv),
    blocksOnePost: blocks.filter((b) => b.scope === "one_post").map(iv),
    /** Записи на конкретном посту: для услуг, закреплённых за постом */
    onStaff: (staffId: string) => bookings.filter((b) => b.staffId === staffId).map(iv),
  };
}

type BusinessForSlots = {
  id: string;
  timezone: string;
  posts: number;
  onlinePosts: number;
  standPosts: number;
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
  onlinePosts: true,
  standPosts: true,
  slotStepMin: true,
  minLeadMin: true,
  horizonDays: true,
  hours: true,
  exceptions: true,
} satisfies Prisma.BusinessSelect;

/** Услуга для расчёта окон: длительность, стенд развала, закреплённый пост. Просто число — длительность услуги на любом посту. */
export type SlotService = number | { durationMin: number; onStand?: boolean; staffId?: string | null };
const svc = (s: SlotService) =>
  typeof s === "number" ? { durationMin: s, onStand: false, staffId: null } : { durationMin: s.durationMin, onStand: !!s.onStand, staffId: s.onStand ? null : (s.staffId ?? null) };

export async function getDaySlots(
  biz: BusinessForSlots,
  date: string,
  service: SlotService,
  nowMs = Date.now(),
  tx: Tx = db,
): Promise<Slot[]> {
  const { durationMin, onStand, staffId } = svc(service);
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
    onlinePosts: biz.onlinePosts,
    standPosts: biz.standPosts,
    onStand,
    ...occ,
    pinnedBusy: staffId ? occ.onStaff(staffId) : undefined,
    nowMs,
    minLeadMin: biz.minLeadMin,
  });
}

export type DayLoad = { date: string; open: number; close: number; now: number | null; busy: LaneSpan[]; lunch: LaneSpan | null } | null;

/** Когда сервис занят целиком (все посты), для витрины сайта («План», «Такси»). null — выходной или вне горизонта. */
export async function getDayLoad(biz: BusinessForSlots, date: string, nowMs = Date.now()): Promise<DayLoad> {
  if (!inHorizon(date, nowMs, biz.timezone, biz.horizonDays)) return null;
  const window = resolveDayWindow(date, biz.hours, biz.exceptions);
  if (!window) return null;
  const all = await loadDay(db, biz.id, date, biz.timezone);
  // Витрина показывает, когда заняты все посты; записи на стенде развала посты не занимают
  const occ = { ...all, bookings: splitStand(all.bookings, biz.standPosts).posts, siteBookings: splitStand(all.siteBookings, biz.standPosts).posts };
  const local = toLocal(nowMs, biz.timezone);
  const day = dayLanes({ date, tz: biz.timezone, window, posts: biz.posts, ...occ });
  // Для записи с сайта занято и тогда, когда заняты все посты под онлайн-запись (записями с сайта или закрытием поста)
  const online = Math.min(biz.onlinePosts, biz.posts);
  const onlineBusy = online < biz.posts
    ? fullBusy(dayLanes({ date, tz: biz.timezone, window, posts: online, bookings: occ.siteBookings, blocksAll: occ.blocksAll, blocksOnePost: occ.blocksOnePost }).lanes)
    : [];
  const lunch = window.breakFrom != null && window.breakTo != null ? { from: window.breakFrom, to: window.breakTo } : null;
  return { date, open: day.open, close: day.close, busy: unionSpans(fullBusy(day.lanes), onlineBusy), now: local.date === date ? local.minutes : null, lunch };
}

/** ended — день рабочий, но окон нет совсем (сегодня время уже вышло): это «поздно», а не «занято». */
export type DaySummary = { date: string; closed: boolean; free: number; ended?: true };

/** Сводка по дням горизонта для полоски дат: выходной или сколько свободных окон. Один запрос к базе. */
export async function getHorizonSummary(biz: BusinessForSlots, service: SlotService, nowMs = Date.now()): Promise<DaySummary[]> {
  const { durationMin, onStand, staffId } = svc(service);
  const dates = horizonDates(nowMs, biz.timezone, biz.horizonDays);
  const occ = await loadRange(db, biz.id, dates[0], dates[dates.length - 1], biz.timezone);
  return dates.map((date) => {
    const window = resolveDayWindow(date, biz.hours, biz.exceptions);
    if (!window) return { date, closed: true, free: 0 };
    const slots = daySlots({
      date, tz: biz.timezone, window, durationMin, stepMin: biz.slotStepMin, posts: biz.posts, onlinePosts: biz.onlinePosts,
      standPosts: biz.standPosts, onStand, ...occ, pinnedBusy: staffId ? occ.onStaff(staffId) : undefined, nowMs, minLeadMin: biz.minLeadMin,
    });
    // «Поздно» — только сегодня и только когда окна были, но время уже вышло (а не услуга длиннее рабочего дня)
    const ended = slots.length === 0 && date === dates[0] && daySlots({
      date, tz: biz.timezone, window, durationMin, stepMin: biz.slotStepMin, posts: biz.posts, standPosts: biz.standPosts, onStand,
      bookings: [], blocksAll: [], blocksOnePost: [], nowMs: 0, minLeadMin: 0,
    }).length > 0;
    return { date, closed: false, free: slots.filter((s) => s.free).length, ...(ended ? { ended: true as const } : {}) };
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
    // Повтор той же записи (ответ сервера потерялся в плохой сети, клиент нажал «Записаться» ещё раз):
    // отдаём уже созданную запись, а не ошибку «на этот номер уже есть запись». Сверяем и имя с машиной:
    // знающий только телефон и время не получит чужую ссылку на отмену
    if (pd) {
      const [hh, mm] = input.time.split(":").map(Number);
      const same = await tx.booking.findFirst({
        where: {
          businessId: input.businessId, serviceId: service.id, clientPhone: input.clientPhone, clientName: input.clientName, car: input.car, status: "active",
          startAt: new Date(localToUtc(input.date, hh * 60 + mm, biz.timezone)), createdAt: { gt: new Date(Date.now() - 15 * 60000) }, // createdAt ставит база по настоящим часам
        },
      });
      if (same) return { ...same, repeated: true };
    }
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
    const slots = await getDaySlots(biz, input.date, service, nowMs, tx);
    const slot = slots.find((s) => s.time === input.time);
    // Чаще всего время просто прошло (или ушло за «запас до записи»), пока клиент заполнял форму
    if (!slot) throw new BookingError("bad_slot", "Это время уже недоступно. Выберите другое");
    if (!slot.free) throw new BookingError("slot_taken", "Это время только что заняли. Выберите другое");
    const created = await tx.booking.create({
      data: {
        businessId: input.businessId,
        serviceId: service.id,
        serviceName: service.name,
        priceFrom: service.priceFrom,
        onStand: service.onStand,
        // Услуга закреплена за постом — на него (окно выше уже проверено по этому посту)
        staffId: (!service.onStand && service.staffId) || (await freeStaff(tx, input.businessId, service.onStand, new Date(slot.start), new Date(slot.end), biz.standPosts)),
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
    return { ...created, repeated: false };
  }, TX_OPTIONS);
}

export type OwnerBookingInput = {
  businessId: string;
  /** Услуга из списка или своя запись текстом (custom): что делаем, сколько длится, на стенде ли развала */
  serviceId?: string;
  custom?: { title: string; durationMin: number; onStand?: boolean };
  /** К какому сотруднику; не задан — к первому свободному */
  staffId?: string;
  /** Кто внёс запись в кабинете */
  createdById?: string;
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
export type OwnerWarning = { load: number; posts: number; allClosed: boolean; outside: boolean; stand: boolean };

/**
 * Пересекается ли интервал с часами работы, обедом, закрытым временем и другими записями.
 * onStand — запись на стенд развала: считаем занятость стендов, а не постов.
 */
async function checkCapacity(tx: Tx, biz: BusinessForSlots, date: string, slot: Interval, onStand: boolean, ignoreBookingId?: string): Promise<OwnerWarning | null> {
  const window = resolveDayWindow(date, biz.hours, biz.exceptions);
  const dayStart = localToUtc(date, 0, biz.timezone);
  const outside = !window || slot.start < dayStart + window.openMin * 60000 || slot.end > dayStart + window.closeMin * 60000;
  const occ = await loadDay(tx, biz.id, date, biz.timezone);
  let bookings = occ.bookings;
  if (ignoreBookingId) {
    const self = await tx.booking.findUnique({ where: { id: ignoreBookingId }, select: { startAt: true, endAt: true, status: true, onStand: true } });
    if (self && (OCCUPYING as readonly string[]).includes(self.status)) {
      const i = bookings.findIndex((b) => b.start === self.startAt.getTime() && b.end === self.endAt.getTime() && !!b.stand === self.onStand);
      if (i >= 0) bookings = bookings.filter((_, k) => k !== i);
    }
  }
  const closed = [...occ.blocksAll, ...breakIntervals(date, biz.timezone, window)];
  const allClosed = closed.some((b) => b.start < slot.end && slot.start < b.end);
  const split = splitStand(bookings, biz.standPosts);
  const stand = onStand && biz.standPosts > 0;
  const cap = stand ? biz.standPosts : biz.posts;
  const load = stand ? peakLoad(slot, split.stand) : peakLoad(slot, [...split.posts, ...occ.blocksOnePost]);
  return outside || allClosed || load >= cap ? { load, posts: cap, allClosed, outside, stand } : null;
}

export async function createOwnerBooking(input: OwnerBookingInput) {
  return db.$transaction(async (tx) => {
    await lockBusiness(tx, input.businessId);
    const biz = await tx.business.findUnique({ where: { id: input.businessId }, select: businessForSlotsSelect });
    // Своя запись без услуги: название, длительность и стенд вписал владелец (как событие в календаре)
    const service = input.custom
      ? { id: null, name: input.custom.title, priceFrom: null, durationMin: input.custom.durationMin, onStand: !!input.custom.onStand }
      : await tx.service.findFirst({ where: { id: input.serviceId, businessId: input.businessId } });
    if (!biz || !service) throw new BookingError("not_found", "Услуга не найдена");
    const start = localToUtc(input.date, input.startMin, biz.timezone);
    const slot = { start, end: start + service.durationMin * 60000 };
    const warning = await checkCapacity(tx, biz, input.date, slot, service.onStand);
    if (warning && !input.force) {
      return { booking: null, warning };
    }
    const booking = await tx.booking.create({
      data: {
        businessId: biz.id,
        serviceId: service.id,
        serviceName: service.name,
        priceFrom: service.priceFrom,
        onStand: service.onStand,
        // Пост выбран вручную — он; иначе закреплённый за услугой; иначе первый свободный
        staffId: input.staffId ?? (("staffId" in service && !service.onStand && service.staffId) || (await freeStaff(tx, biz.id, service.onStand, new Date(slot.start), new Date(slot.end), biz.standPosts))),
        createdById: input.createdById ?? null,
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
 * Владелец меняет запись: что делаем, день, время, длительность, пост. Проверка постов — как при записи,
 * без самой этой записи; при перегрузке без подтверждения (force) не меняем.
 */
export async function updateOwnerBooking(input: OwnerBookingInput & { id: string }) {
  return db.$transaction(async (tx) => {
    await lockBusiness(tx, input.businessId);
    const b = await tx.booking.findFirst({ where: { id: input.id, businessId: input.businessId } });
    const biz = await tx.business.findUnique({ where: { id: input.businessId }, select: businessForSlotsSelect });
    if (!b || !biz) throw new BookingError("not_found", "Запись не найдена");
    const found = input.serviceId ? await tx.service.findFirst({ where: { id: input.serviceId, businessId: input.businessId } }) : null;
    // Услугу могли удалить из списка: запись с ней остаётся как была, меняется только время и пост
    const kept = input.serviceId && !found && input.serviceId === b.serviceId
      ? { id: b.serviceId, name: b.serviceName, priceFrom: b.priceFrom, durationMin: input.custom?.durationMin ?? (b.endAt.getTime() - b.startAt.getTime()) / 60000, onStand: b.onStand }
      : null;
    const service = input.custom && !input.serviceId
      ? { id: null, name: input.custom.title, priceFrom: null, durationMin: input.custom.durationMin, onStand: !!input.custom.onStand }
      : found ?? kept;
    if (!service) throw new BookingError("not_found", "Услуга не найдена");
    const start = localToUtc(input.date, input.startMin, biz.timezone);
    const slot = { start, end: start + service.durationMin * 60000 };
    const warning = b.status === "active" || b.status === "done" ? await checkCapacity(tx, biz, input.date, slot, service.onStand, b.id) : null;
    if (warning && !input.force) return { booking: null, warning };
    const booking = await tx.booking.update({
      where: { id: b.id },
      data: {
        serviceId: service.id,
        serviceName: service.name,
        priceFrom: service.priceFrom,
        onStand: service.onStand,
        // Пост выбран вручную — он; иначе закреплённый за услугой; иначе первый свободный
        staffId: input.staffId ?? (("staffId" in service && !service.onStand && service.staffId) || (await freeStaff(tx, biz.id, service.onStand, new Date(slot.start), new Date(slot.end), biz.standPosts, b.id))),
        startAt: new Date(slot.start),
        endAt: new Date(slot.end),
        clientName: input.clientName || null,
        clientPhone: input.clientPhone || null,
        // Запись одним полем: машина уже в тексте
        car: input.custom && !input.serviceId ? null : input.car === undefined ? b.car : input.car || null,
        comment: input.comment || null,
      },
    });
    return { booking, warning: null };
  }, TX_OPTIONS);
}

/**
 * Перетаскивание в календаре: новое время и длительность, без проверки постов — календарь в свободной форме,
 * как в Google. Сайт видит новое время сразу: запись занимает пост там, куда её поставили.
 */
export async function moveBooking(businessId: string, id: string, start: number, end: number) {
  return db.$transaction(async (tx) => {
    await lockBusiness(tx, businessId);
    const r = await tx.booking.updateMany({ where: { id, businessId }, data: { startAt: new Date(start), endAt: new Date(end) } });
    if (!r.count) throw new BookingError("not_found", "Запись не найдена");
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
    const warning = await checkCapacity(tx, biz, date, { start: b.startAt.getTime(), end: b.endAt.getTime() }, b.onStand, id);
    if (warning && !force) return { ok: false as const, warning };
    await tx.booking.update({ where: { id }, data: { status: "active", cancelledAt: null, cancelledBy: null } });
    return { ok: true as const, warning: null };
  }, TX_OPTIONS);
}

/** Активные записи, которые попадают в интервал: для предупреждения при закрытии времени и праздниках. */
export async function bookingsInRange(businessId: string, start: number, end: number) {
  return db.booking.findMany({
    where: { businessId, status: "active", startAt: { gte: new Date(start - 86400000), lt: new Date(end) }, endAt: { gt: new Date(start) } },
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
