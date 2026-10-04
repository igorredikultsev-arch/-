"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import "@/lib/zod-ru";
import { audit, endOtherSessions, hashPassword, passwordProblem, requireOwner, verifyPassword } from "@/lib/auth";
import { hit } from "@/lib/ratelimit";
import { bookingsInRange, createOwnerBooking, getDaySlots, businessForSlotsSelect, restoreBooking, type OwnerWarning } from "@/lib/booking";
import { formatPhone } from "@/lib/phone";
import { dayBounds } from "@/lib/slots";
import { db } from "@/lib/db";
import { OFFER_VERSION } from "@/lib/legal";
import { imageMime, LOGO_MAX_BYTES } from "@/lib/logo";
import { notifyBusiness } from "@/lib/push";
import { normalizePhone } from "@/lib/phone";
import { hhmm, isDateString, localToUtc, parseHhmm, toLocal } from "@/lib/time";

export type ActionResult = { ok?: boolean; error?: string; message?: string } | null;

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

async function ownBooking(id: string) {
  const { user, business } = await requireOwner();
  const b = await db.booking.findFirst({ where: { id, businessId: business.id } });
  if (!b) throw new Error("Запись не найдена");
  return { user, business, booking: b };
}

/* ---------- записи ---------- */

/** Текст предупреждения, когда запись не помещается: вне часов, на обеде или закрытом времени, все посты заняты. */
function warningText(w: OwnerWarning) {
  if (w.outside) return "Это время вне часов работы. Всё равно записать?";
  if (w.allClosed) return "Это время закрыто (обед или закрытое время). Всё равно записать?";
  return `В это время заняты все посты (${w.load} из ${w.posts}). Всё равно записать?`;
}

export async function setBookingStatus(
  id: string,
  status: "active" | "cancelled" | "no_show" | "done",
  force = false,
): Promise<{ warning?: string } | void> {
  const { user, business, booking } = await ownBooking(id);
  // «Приехал» и «Не приехал» — только для начавшейся и не отменённой записи (кнопки в кабинете так и показаны,
  // проверка на случай старой открытой страницы): отменённую сначала возвращают, чтобы проверить свободные посты
  if ((status === "done" || status === "no_show") && (booking.status === "cancelled" || booking.startAt.getTime() > Date.now())) return;
  if (status === "active" && booking.status !== "active") {
    // Пока запись была отменена, её время могли занять: без подтверждения двух клиентов на одно место не ставим
    const r = await restoreBooking(id, business.id, force);
    if (!r.ok) {
      const w = r.warning;
      return { warning: w.outside || w.allClosed ? warningText(w).replace("записать", "вернуть") : `На это время уже заняты все посты (${w.load} из ${w.posts}). Всё равно вернуть запись?` };
    }
  } else {
    await db.booking.update({
      where: { id },
      data: { status, ...(status === "cancelled" ? { cancelledAt: new Date(), cancelledBy: "owner" } : { cancelledAt: null, cancelledBy: null }) },
    });
  }
  await audit("booking.status", { userId: user.id, businessId: business.id, details: { id, status } });
  revalidatePath("/cabinet", "layout");
}

/** Записи в интервале для предупреждения: «05.10 10:00 Иван, +7 (912) …». */
async function clashRows(businessId: string, tz: string, start: number, end: number) {
  const list = await bookingsInRange(businessId, start, end);
  return list.map((b) => {
    const l = toLocal(b.startAt.getTime(), tz);
    return `${l.date.slice(8, 10)}.${l.date.slice(5, 7)} ${hhmm(l.minutes)} ${b.clientName || "без имени"}${b.clientPhone ? `, ${formatPhone(b.clientPhone)}` : ""}`;
  });
}

const clashNote = (rows: string[], what: string) =>
  rows.length ? ` Внимание: ${what} уже записаны клиенты, их записи остались: ${rows.join("; ")}. Предупредите их, если нужно перенести.` : "";

/** Право клиента на удаление данных (раздел 6.3, п. 6): обезличиваем запись, время и услуга остаются для статистики. */
export async function erasePersonalData(id: string) {
  const { user, business } = await ownBooking(id);
  await db.booking.update({
    where: { id },
    data: { clientName: null, clientPhone: null, car: null, comment: null, consentIp: null },
  });
  await audit("booking.erase_pd", { userId: user.id, businessId: business.id, details: { id } });
  revalidatePath("/cabinet", "layout");
}

export async function ownerDaySlots(date: string, serviceId: string) {
  const { business } = await requireOwner();
  if (!isDateString(date)) return [];
  const service = await db.service.findFirst({ where: { id: serviceId, businessId: business.id } });
  if (!service) return [];
  const biz = await db.business.findUniqueOrThrow({ where: { id: business.id }, select: businessForSlotsSelect });
  // Владельцу показываем весь день, без «запаса» на подготовку и без ограничения горизонта
  const slots = await getDaySlots({ ...biz, minLeadMin: -24 * 60, horizonDays: 3650 }, date, service.durationMin, Date.now() - 365 * 86400000);
  return slots.map((s) => ({ time: s.time, free: s.free }));
}

const NewBooking = z.object({
  serviceId: z.string().min(1, "Выберите услугу"),
  date: z.string().refine(isDateString, "Выберите день"),
  time: z.string().refine((t) => parseHhmm(t) != null, "Выберите время"),
  name: z.string().max(60).optional(),
  phone: z.string().max(30).optional(),
  comment: z.string().max(500).optional(),
  force: z.boolean().optional(),
});

export async function ownerCreateBooking(input: z.input<typeof NewBooking>): Promise<{ error?: string; warning?: string; id?: string }> {
  const { user, business } = await requireOwner();
  const p = NewBooking.safeParse(input);
  if (!p.success) return { error: p.error.issues[0].message };
  let phone: string | null = null;
  if (p.data.phone && p.data.phone.replace(/\D/g, "").length > 1) {
    phone = normalizePhone(p.data.phone);
    if (!phone) return { error: "Телефон должен быть из 10 цифр после +7 или пустым" };
  }
  const res = await createOwnerBooking({
    businessId: business.id,
    serviceId: p.data.serviceId,
    date: p.data.date,
    startMin: parseHhmm(p.data.time)!,
    clientName: p.data.name?.trim(),
    clientPhone: phone ?? undefined,
    comment: p.data.comment?.trim(),
    force: p.data.force,
  });
  if (!res.booking) return { warning: warningText(res.warning!) };
  await audit("booking.create_owner", { userId: user.id, businessId: business.id, details: { id: res.booking.id } });
  revalidatePath("/cabinet", "layout");
  return { id: res.booking.id };
}

/* ---------- закрытое время ---------- */

export async function createBlock(_prev: ActionResult, f: FormData): Promise<ActionResult> {
  const { user, business } = await requireOwner();
  const date = str(f, "date");
  if (!isDateString(date)) return { error: "Выберите день" };
  const allDay = f.get("allDay") === "on";
  const from = allDay ? 0 : parseHhmm(str(f, "from"));
  const to = allDay ? 24 * 60 : parseHhmm(str(f, "to"));
  if (from == null || to == null || to <= from) return { error: "Время «до» должно быть позже времени «с»" };
  const scope = str(f, "scope") === "one_post" ? "one_post" : "all";
  const startAt = new Date(localToUtc(date, from, business.timezone));
  const endAt = new Date(localToUtc(date, to, business.timezone));
  // Повторное нажатие не создаёт второе такое же закрытие
  const same = await db.block.findFirst({ where: { businessId: business.id, startAt, endAt, scope } });
  if (same) return { ok: true, message: "Это время уже закрыто" };
  await db.block.create({
    data: { businessId: business.id, startAt, endAt, scope, reason: str(f, "reason").slice(0, 60) || null },
  });
  await audit("block.create", { userId: user.id, businessId: business.id });
  revalidatePath("/cabinet", "layout");
  const clash = scope === "all" ? clashNote(await clashRows(business.id, business.timezone, startAt.getTime(), endAt.getTime()), "на это время") : "";
  return { ok: true, message: `Время закрыто. На сайте оно стало недоступным.${clash}` };
}

export async function deleteBlock(id: string) {
  const { business } = await requireOwner();
  await db.block.deleteMany({ where: { id, businessId: business.id } });
  revalidatePath("/cabinet", "layout");
}

/* ---------- услуги ---------- */

const ServiceForm = z.object({
  name: z.string().trim().min(2, "Название слишком короткое").max(80),
  category: z.string().trim().min(2, "Укажите раздел").max(40),
  description: z.string().trim().max(120),
  priceFrom: z.coerce.number().int().min(0).max(1_000_000),
  durationMin: z.coerce.number().int().min(10, "Не меньше 10 минут").max(600, "Не больше 10 часов"),
  isDiagnostic: z.boolean(),
  active: z.boolean(),
});

function readService(f: FormData) {
  return ServiceForm.safeParse({
    name: str(f, "name"),
    category: str(f, "category"),
    description: str(f, "description"),
    priceFrom: str(f, "priceFrom") || "0",
    durationMin: str(f, "durationMin"),
    isDiagnostic: f.get("isDiagnostic") === "on",
    active: f.get("active") === "on",
  });
}

export async function saveService(id: string | null, _prev: ActionResult, f: FormData): Promise<ActionResult> {
  const { user, business } = await requireOwner();
  const p = readService(f);
  if (!p.success) return { error: p.error.issues[0].message };
  if (id) {
    const r = await db.service.updateMany({ where: { id, businessId: business.id }, data: { ...p.data, description: p.data.description || null } });
    if (!r.count) return { error: "Услуга не найдена" };
  } else {
    const max = await db.service.aggregate({ where: { businessId: business.id }, _max: { sortOrder: true } });
    await db.service.create({
      data: { ...p.data, description: p.data.description || null, businessId: business.id, sortOrder: (max._max.sortOrder ?? 0) + 1 },
    });
  }
  await audit("service.save", { userId: user.id, businessId: business.id });
  revalidatePath("/cabinet/site", "layout");
  revalidatePath("/s/[slug]", "layout");
  if (!id) redirect("/cabinet/site/services");
  return { ok: true, message: "Сохранено" };
}

export async function deleteService(id: string) {
  const { business } = await requireOwner();
  await db.service.deleteMany({ where: { id, businessId: business.id } });
  revalidatePath("/cabinet/site", "layout");
  redirect("/cabinet/site/services");
}

/* ---------- часы работы и особые дни ---------- */

export async function saveHours(_prev: ActionResult, f: FormData): Promise<ActionResult> {
  const { user, business } = await requireOwner();
  const rows = [];
  for (let wd = 1; wd <= 7; wd++) {
    const closed = f.get(`closed${wd}`) === "on";
    const open = parseHhmm(str(f, `open${wd}`));
    const close = parseHhmm(str(f, `close${wd}`));
    if (!closed && (open == null || close == null || close <= open)) return { error: "Проверьте часы: закрытие должно быть позже открытия" };
    // Обед: оба поля или ни одного, внутри часов работы
    const bFrom = str(f, `breakFrom${wd}`) ? parseHhmm(str(f, `breakFrom${wd}`)) : null;
    const bTo = str(f, `breakTo${wd}`) ? parseHhmm(str(f, `breakTo${wd}`)) : null;
    const hasBreak = bFrom != null && bTo != null;
    if (!closed && (bFrom != null) !== (bTo != null)) return { error: "Обед: укажите и начало, и конец, или оставьте оба поля пустыми" };
    if (!closed && hasBreak && (bTo! <= bFrom! || bFrom! < open! || bTo! > close!)) return { error: "Обед должен быть внутри часов работы, конец позже начала" };
    rows.push({ weekday: wd, closed, openMin: open ?? 540, closeMin: close ?? 1200, breakFromMin: hasBreak ? bFrom : null, breakToMin: hasBreak ? bTo : null });
  }
  await db.$transaction(
    rows.map((r) =>
      db.workingHours.upsert({
        where: { businessId_weekday: { businessId: business.id, weekday: r.weekday } },
        create: { ...r, businessId: business.id },
        update: r,
      }),
    ),
  );
  await audit("hours.save", { userId: user.id, businessId: business.id });
  revalidatePath("/cabinet", "layout");
  return { ok: true, message: "Часы работы сохранены" };
}

export async function addException(_prev: ActionResult, f: FormData): Promise<ActionResult> {
  const { business } = await requireOwner();
  const date = str(f, "date");
  if (!isDateString(date)) return { error: "Выберите день" };
  const closed = str(f, "mode") !== "short";
  const open = parseHhmm(str(f, "open"));
  const close = parseHhmm(str(f, "close"));
  if (!closed && (open == null || close == null || close <= open)) return { error: "Проверьте часы особого дня" };
  await db.dayException.upsert({
    where: { businessId_date: { businessId: business.id, date } },
    create: { businessId: business.id, date, closed, openMin: closed ? null : open, closeMin: closed ? null : close },
    update: { closed, openMin: closed ? null : open, closeMin: closed ? null : close },
  });
  revalidatePath("/cabinet", "layout");
  // Клиенты, которые записаны на закрытый день или вне новых часов
  const day = dayBounds(date, business.timezone);
  const tz = business.timezone;
  const rows = closed
    ? await clashRows(business.id, tz, day.start, day.end)
    : [...(await clashRows(business.id, tz, day.start, localToUtc(date, open!, tz))), ...(await clashRows(business.id, tz, localToUtc(date, close!, tz), day.end))];
  const clash = clashNote(rows, closed ? "на этот день" : "вне новых часов");
  return { ok: true, message: `Особый день добавлен.${clash}` };
}

export async function deleteException(id: string) {
  const { business } = await requireOwner();
  await db.dayException.deleteMany({ where: { id, businessId: business.id } });
  revalidatePath("/cabinet", "layout");
}

/* ---------- настройки и тексты сайта ---------- */

const Texts = z.object({
  headline: z.string().trim().max(70),
  addressNote: z.string().trim().max(120),
});

const Rules = z.object({
  posts: z.coerce.number().int().min(1, "Хотя бы 1 пост").max(20),
  cancelHours: z.coerce.number().int().min(0).max(168),
  horizonDays: z.coerce.number().int().min(1).max(60),
  minLeadMin: z.coerce.number().int().min(0).max(48 * 60),
  slotStepMin: z.coerce.number().int().refine((v) => [15, 30, 60].includes(v), "Шаг 15, 30 или 60 минут"),
});

const pick = (f: FormData, keys: string[]) => Object.fromEntries(keys.map((k) => [k, str(f, k)]));

function siteChanged() {
  revalidatePath("/cabinet", "layout");
  revalidatePath("/s/[slug]", "layout");
}

export async function saveTexts(_prev: ActionResult, f: FormData): Promise<ActionResult> {
  const { user, business } = await requireOwner();
  const p = Texts.safeParse(pick(f, ["headline", "addressNote"]));
  if (!p.success) return { error: p.error.issues[0].message };
  const facts = [0, 1, 2]
    .map((i) => ({ value: str(f, `factValue${i}`).slice(0, 20), label: str(f, `factLabel${i}`).slice(0, 40) }))
    .filter((x) => x.value && x.label);
  await db.business.update({ where: { id: business.id }, data: { headline: p.data.headline || null, addressNote: p.data.addressNote || null, facts } });
  await audit("settings.save", { userId: user.id, businessId: business.id, details: { part: "texts" } });
  siteChanged();
  return { ok: true, message: "Сохранено. Изменения уже на сайте" };
}

export async function saveRules(_prev: ActionResult, f: FormData): Promise<ActionResult> {
  const { user, business } = await requireOwner();
  const p = Rules.safeParse(pick(f, ["posts", "cancelHours", "horizonDays", "minLeadMin", "slotStepMin"]));
  if (!p.success) return { error: p.error.issues[0].message };
  await db.business.update({ where: { id: business.id }, data: p.data });
  await audit("settings.save", { userId: user.id, businessId: business.id, details: { part: "rules" } });
  siteChanged();
  return { ok: true, message: "Сохранено. Сайт уже считает свободное время по новым правилам" };
}

/* ---------- логотип ---------- */

/** Картинку заранее уменьшает браузер (до 512 точек по длинной стороне), здесь — проверка типа и размера. */
export async function uploadLogo(_prev: ActionResult, f: FormData): Promise<ActionResult> {
  const { user, business } = await requireOwner();
  const file = f.get("logo");
  if (!(file instanceof File) || file.size === 0) return { error: "Выберите картинку с логотипом" };
  if (file.size > LOGO_MAX_BYTES) return { error: "Картинка слишком большая. Попробуйте другой файл: PNG или JPG" };
  const data = new Uint8Array(await file.arrayBuffer());
  const mime = imageMime(data);
  if (!mime) return { error: "Подходят картинки PNG, JPG или WebP" };
  const now = new Date();
  await db.$transaction([
    db.businessLogo.upsert({ where: { businessId: business.id }, create: { businessId: business.id, data, mime }, update: { data, mime } }),
    db.business.update({ where: { id: business.id }, data: { logoAt: now } }),
  ]);
  await audit("logo.upload", { userId: user.id, businessId: business.id });
  siteChanged();
  return { ok: true, message: "Логотип загружен и уже виден на сайте" };
}

export async function removeLogo(): Promise<ActionResult> {
  const { user, business } = await requireOwner();
  await db.$transaction([
    db.businessLogo.deleteMany({ where: { businessId: business.id } }),
    db.business.update({ where: { id: business.id }, data: { logoAt: null } }),
  ]);
  await audit("logo.remove", { userId: user.id, businessId: business.id });
  siteChanged();
  return { ok: true, message: "Логотип убран с сайта" };
}

/* ---------- пароль ---------- */

export async function changePassword(_prev: ActionResult, f: FormData): Promise<ActionResult> {
  const { user, asAdmin } = await requireOwner();
  if (asAdmin) return { error: "Это кабинет клиента: новый пароль владельцу выдаётся в админке" };
  const current = String(f.get("current") ?? "");
  const next = String(f.get("next") ?? "");
  const weak = passwordProblem(next, user.phone);
  if (weak) return { error: weak };
  if (!(await verifyPassword(user.passwordHash, current))) return { error: "Текущий пароль неверный" };
  await db.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(next) } });
  // Остальные входы (например, на потерянном телефоне) завершаем, текущий оставляем
  await endOtherSessions(user.id);
  await audit("password.change", { userId: user.id });
  return { ok: true, message: "Пароль изменён" };
}

/* ---------- оферта ---------- */

/** Владелец принимает условия оферты галочкой при первом входе (оферта, п. 1.2). */
export async function acceptOffer(_prev: ActionResult, f: FormData): Promise<ActionResult> {
  const { user, business, asAdmin } = await requireOwner();
  if (asAdmin) return { error: "Условия принимает сам владелец, при своём входе в кабинет" };
  if (f.get("agree") !== "on") return { error: "Отметьте, что принимаете условия" };
  await db.business.update({ where: { id: business.id }, data: { offerAcceptedAt: new Date(), offerVersion: OFFER_VERSION } });
  await audit("offer.accept", { userId: user.id, businessId: business.id, details: { version: OFFER_VERSION } });
  revalidatePath("/cabinet", "layout");
  return { ok: true };
}

/* ---------- уведомления ---------- */

// Адреса подписки выдают только службы уведомлений браузеров. Любой другой адрес не принимаем:
// иначе сервер по команде из кабинета слал бы запросы куда угодно
const PUSH_HOSTS = [/(^|\.)googleapis\.com$/, /(^|\.)push\.apple\.com$/, /(^|\.)push\.services\.mozilla\.com$/, /(^|\.)notify\.windows\.com$/, /(^|\.)yandex\.(ru|net)$/];
const pushHostOk = (u: string) => {
  try {
    const url = new URL(u);
    return url.protocol === "https:" && PUSH_HOSTS.some((r) => r.test(url.hostname));
  } catch {
    return false;
  }
};

const PushSub = z.object({
  endpoint: z.string().max(1000).refine(pushHostOk),
  keys: z.object({ p256dh: z.string().min(10).max(200), auth: z.string().min(8).max(100) }),
});

/** Телефон владельца подписался на уведомления кабинета. */
export async function savePushSubscription(raw: unknown): Promise<ActionResult> {
  const { user, business, asAdmin } = await requireOwner();
  if (asAdmin) return { error: "Уведомления включает сам владелец на своём телефоне" };
  const p = PushSub.safeParse(raw);
  if (!p.success) return { error: "Не получилось включить уведомления. Обновите страницу и попробуйте ещё раз" };
  const { endpoint, keys } = p.data;
  await db.pushSubscription.upsert({
    where: { endpoint },
    create: { endpoint, p256dh: keys.p256dh, auth: keys.auth, userId: user.id, businessId: business.id },
    update: { p256dh: keys.p256dh, auth: keys.auth, userId: user.id, businessId: business.id },
  });
  // Не больше 10 устройств на сервис: самые старые подписки уходят
  const extra = await db.pushSubscription.findMany({ where: { businessId: business.id }, orderBy: { createdAt: "desc" }, skip: 10, select: { id: true } });
  if (extra.length) await db.pushSubscription.deleteMany({ where: { id: { in: extra.map((x) => x.id) } } });
  await audit("push.subscribe", { userId: user.id, businessId: business.id });
  revalidatePath("/cabinet", "layout");
  return { ok: true };
}

export async function removePushSubscription(endpoint: string): Promise<ActionResult> {
  const { business } = await requireOwner();
  await db.pushSubscription.deleteMany({ where: { endpoint, businessId: business.id } });
  revalidatePath("/cabinet", "layout");
  return { ok: true };
}

/** Проверочное уведомление на все телефоны владельца (и при подключении из админки). */
export async function testPush(): Promise<ActionResult> {
  const { business } = await requireOwner();
  if (!(await hit(`push:test:${business.id}`, 10, 3600))) return { error: "Проверка уже была много раз за этот час. Попробуйте позже" };
  const r = await notifyBusiness(business.id, { title: "Уведомления работают", body: "Так будут приходить новые записи и отмены", url: "/cabinet", tag: "test" });
  if (!r.sent) return { error: "Нет телефонов с включёнными уведомлениями" };
  return {
    ok: true,
    message: r.sent === 1
      ? "Отправлено. Обычно уведомление приходит за несколько секунд, иногда до пары минут"
      : `Отправлено на ${r.sent} ${r.sent % 10 >= 2 && r.sent % 10 <= 4 && (r.sent % 100 < 10 || r.sent % 100 >= 20) ? "устройства" : "устройств"}`,
  };
}

/** Утренняя сводка в 8:00: включить или выключить. */
export async function setDigest(on: boolean): Promise<ActionResult> {
  const { business } = await requireOwner();
  await db.business.update({ where: { id: business.id }, data: { digestEnabled: on } });
  revalidatePath("/cabinet/more/push");
  return { ok: true };
}
