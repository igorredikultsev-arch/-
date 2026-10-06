"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { firstIssue } from "@/lib/zod-ru";
import { audit, endAllSessions, generatePassword, hashPassword, requireAdmin, requireOwner, setAdminView } from "@/lib/auth";
import { isDateString } from "@/lib/time";
import { isAllowedZone, isKnownCity, timezoneForCity } from "@/lib/timezone";
import { matchForImport } from "@/lib/import-match";
import { connectFirst, statusChange } from "@/lib/readiness";
import { isHexColor } from "@/lib/color";
import { THEME_KEYS } from "@/lib/themes";
import { db } from "@/lib/db";
import { parseDemoRows, type DemoInput } from "@/lib/demo-import";
import { earlyPrice } from "@/lib/business";
import { demoMessage, emailSubject, outreach, withLink } from "@/lib/outreach";
import { normalizePhone } from "@/lib/phone";
import { UNPAID_GRACE_DAYS } from "@/lib/pricing";
import { readTable } from "@/lib/sheet";
import { publicSiteUrl } from "@/lib/site-url";
import { RESERVED_SLUGS, slugify } from "@/lib/slug";
import { DEFAULT_FACTS, DEFAULT_HOURS, TEMPLATES } from "@/lib/templates";
import { canBulkDelete } from "./labels";

export type AdminResult = { ok?: boolean; error?: string; message?: string; password?: string; id?: string } | null;

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const URL_MSG = "нужна ссылка вида https://…";
const optUrl = z.union([z.literal(""), z.string().url(URL_MSG).refine((v) => /^https?:\/\//i.test(v), URL_MSG)], { error: URL_MSG });
const optInt = z.union([z.literal(""), z.coerce.number().int().min(0)], { error: "целое число, например 98" });
// Рейтинг пишут и «4.8», и «4,8»
const optRating = z.union([z.literal(""), z.preprocess((v) => String(v).replace(",", "."), z.coerce.number().min(1).max(5))], {
  error: "число от 1 до 5, например 4,8",
});

// Названия полей для сообщений об ошибках: «Рейтинг: число от 1 до 5»
const LABELS: Record<string, string> = {
  name: "Название", city: "Город", timezone: "Часовой пояс", address: "Адрес", phone: "Телефон", yandexMapsUrl: "Яндекс Карты", twoGisUrl: "2ГИС",
  rating: "Рейтинг", reviewsYandex: "Отзывов в Яндексе", reviews2gis: "Отзывов в 2ГИС", template: "Набор услуг", theme: "Тема",
  accent: "Цвет", posts: "Постов", headline: "Заголовок", channel: "Канал", contact: "Контакт",
  operatorName: "Оператор ПДн", operatorInn: "ИНН оператора", customDomain: "Свой домен", status: "Этап", notes: "Заметки",
};

const DEMO_DAYS = 14;

/** +N месяцев без перескока: 31 января + 1 месяц = 28 (29) февраля, а не 3 марта. */
function addMonths(d: Date, n: number) {
  const r = new Date(d);
  const day = r.getDate();
  r.setDate(1);
  r.setMonth(r.getMonth() + n);
  r.setDate(Math.min(day, new Date(r.getFullYear(), r.getMonth() + 1, 0).getDate()));
  return r;
}


async function uniqueSlug(base: string) {
  let slug = RESERVED_SLUGS.has(base) ? `${base}-1` : base;
  for (let i = 2; await db.business.findUnique({ where: { slug } }); i++) slug = `${base}-${i}`;
  return slug;
}

const Demo = z.object({
  name: z.string().min(2, "Укажите название"),
  city: z.string().min(2),
  address: z.string().min(3, "Укажите адрес"),
  phone: z.string().min(5, "Укажите телефон"),
  yandexMapsUrl: optUrl,
  twoGisUrl: optUrl,
  rating: optRating,
  reviewsYandex: optInt,
  reviews2gis: optInt,
  template: z.enum(["tire", "express"]),
  theme: z.enum(THEME_KEYS),
  accent: z.string().refine(isHexColor, "Цвет в формате #1f9d55"),
  posts: z.coerce.number().int().min(1).max(20),
  headline: z.string().max(70),
  channel: z.string().max(40),
  contact: z.string().max(120),
});

type NewDemo = Omit<DemoInput, "message" | "notes"> & { notes?: string | null; firstMessage?: string | null };

async function insertDemo(d: NewDemo) {
  const slug = await uniqueSlug(slugify(d.name));
  return db.business.create({
    data: {
      slug,
      name: d.name,
      city: d.city,
      timezone: timezoneForCity(d.city),
      address: d.address,
      phone: d.phone,
      yandexMapsUrl: d.yandexMapsUrl,
      twoGisUrl: d.twoGisUrl,
      rating: d.rating,
      reviewsYandex: d.reviewsYandex,
      reviews2gis: d.reviews2gis,
      theme: d.theme,
      accent: d.accent,
      posts: d.posts,
      headline: d.headline,
      // Число постов клиенту не показываем: в демо оно взято наугад, а записи и так учитывают все посты
      // «R13–R22, любые диаметры» — только шиномонтажу: экспресс-сервису (масло, тормоза) такой факт не про него
      facts: d.template === "tire" ? [DEFAULT_FACTS[1]] : [],
      status: "demo",
      demoExpiresAt: new Date(Date.now() + DEMO_DAYS * 86400000),
      hours: { create: DEFAULT_HOURS },
      services: { create: TEMPLATES[d.template].services.map((s, i) => ({ ...s, sortOrder: i })) },
      lead: { create: { status: "new", channel: d.channel, contact: d.contact, notes: d.notes ?? null, firstMessage: d.firstMessage ?? null } },
    },
  });
}

/** Быстрое демо (раздел 2.3): 2-3 минуты от карточки на картах до персональной ссылки. */
export async function createDemo(_prev: AdminResult, f: FormData): Promise<AdminResult> {
  const admin = await requireAdmin();
  const p = Demo.safeParse(Object.fromEntries([...f.keys()].map((k) => [k, str(f, k)])));
  if (!p.success) return { error: firstIssue(p.error, LABELS) };
  const d = p.data;
  const phone = normalizePhone(d.phone);
  if (!phone) return { error: "Телефон: 10 цифр после +7" };
  const biz = await insertDemo({
    ...d,
    phone,
    yandexMapsUrl: d.yandexMapsUrl || null,
    twoGisUrl: d.twoGisUrl || null,
    rating: d.rating === "" ? null : d.rating,
    reviewsYandex: d.reviewsYandex === "" ? null : d.reviewsYandex,
    reviews2gis: d.reviews2gis === "" ? null : d.reviews2gis,
    headline: d.headline || null,
    channel: d.channel || null,
    contact: d.contact || null,
  });
  await audit("admin.demo_create", { userId: admin.id, businessId: biz.id });
  revalidatePath("/admin");
  redirect(`/admin/b/${biz.id}?created=1`);
}

export type ImportRow = { line: number; name: string; status: "created" | "exists" | "skipped"; reason?: string; id?: string; url?: string; message?: string; subject?: string; channel?: string | null; contact?: string | null };
export type ImportResult = { error?: string; sheet?: string; rows?: ImportRow[]; cut?: number } | null;

// Запрос к серверному действию ограничен 1 МБ (настройка Next.js по умолчанию), таблица на сотню строк весит десятки КБ
const MAX_FILE = 900 * 1024;

/**
 * Импорт демо из таблицы лидов: каждая строка с телефоном становится демо со ссылкой и готовым сообщением.
 * Повторная загрузка того же файла не плодит копии: сервис с той же ссылкой 2ГИС или тем же названием и адресом
 * считается уже созданным. Так можно дописать телефоны и загрузить файл ещё раз.
 */
export async function importDemos(_prev: ImportResult, f: FormData): Promise<ImportResult> {
  const admin = await requireAdmin();
  const file = f.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Выберите файл .xlsx или .csv" };
  if (file.size > MAX_FILE) return { error: "Файл больше 900 КБ. Оставьте в нём только лист с сервисами" };
  let parsed: ReturnType<typeof parseDemoRows>;
  try {
    parsed = parseDemoRows(readTable(Buffer.from(await file.arrayBuffer()), file.name));
  } catch (e) {
    return { error: e instanceof Error && /xls|zip|повреж/i.test(e.message) ? e.message : "Не получилось прочитать файл. Сохраните его как .xlsx или .csv" };
  }
  if ("error" in parsed) return { error: parsed.error };

  const rows: ImportRow[] = [];
  const early = await earlyPrice();
  for (const r of parsed.rows) {
    const d = r.demo;
    if (!d) {
      rows.push({ line: r.line, name: r.name, status: "skipped", reason: r.error });
      continue;
    }
    const match = await matchForImport(d);
    if (match.kind === "skip") {
      rows.push({ line: r.line, name: match.biz.name, status: "skipped", reason: match.reason, id: match.biz.id });
      continue;
    }
    const existing = match.kind === "exists" ? match.biz : null;
    const biz = existing ?? (await insertDemo({ ...d, firstMessage: null }));
    const url = publicSiteUrl(biz.slug, biz.customDomain, biz.status);
    const message = existing ? demoMessage(existing.lead?.firstMessage, existing, url, { early }) : d.message ? withLink(d.message, url) : outreach(biz, url, { early });
    if (!existing) {
      await db.lead.update({ where: { businessId: biz.id }, data: { firstMessage: message } });
      await audit("admin.demo_create", { userId: admin.id, businessId: biz.id, details: { import: true } });
    }
    rows.push({ line: r.line, name: biz.name, status: existing ? "exists" : "created", id: biz.id, url, message, subject: emailSubject(biz), channel: existing?.lead?.channel ?? d.channel, contact: existing?.lead?.contact ?? d.contact });
  }
  revalidatePath("/admin");
  return { sheet: parsed.sheet, rows, cut: parsed.cut };
}

const Info = z.object({
  name: z.string().min(2),
  city: z.string().min(2),
  address: z.string().min(3),
  phone: z.string(),
  yandexMapsUrl: optUrl,
  twoGisUrl: optUrl,
  rating: optRating,
  reviewsYandex: optInt,
  reviews2gis: optInt,
  theme: z.enum(THEME_KEYS),
  accent: z.string().refine(isHexColor, "Цвет в формате #1f9d55"),
  operatorName: z.string().max(120),
  operatorInn: z.union([z.literal(""), z.string().regex(/^\d{10}(\d{2})?$/, "ИНН: 10 или 12 цифр")]),
  customDomain: z.union([z.literal(""), z.string().regex(/^[a-z0-9.-]+\.[a-z]{2,}$/i, "Домен вида avtoservis-ivanov.ru")]),
  timezone: z.string().refine(isAllowedZone, "Выберите часовой пояс из списка"),
});

export async function saveInfo(id: string, _prev: AdminResult, f: FormData): Promise<AdminResult> {
  const admin = await requireAdmin();
  const p = Info.safeParse(Object.fromEntries([...f.keys()].map((k) => [k, str(f, k)])));
  if (!p.success) return { error: firstIssue(p.error, LABELS) };
  const d = p.data;
  const phone = normalizePhone(d.phone);
  if (!phone) return { error: "Телефон: 10 цифр после +7" };
  const before = await db.business.findUniqueOrThrow({ where: { id }, select: { city: true, status: true, timezone: true } });
  if (["trial", "active", "suspended"].includes(before.status) && (!d.operatorName.trim() || !d.operatorInn)) {
    return { error: "У подключённого сервиса нельзя стереть «Оператор ПДн» и «ИНН оператора»: без них сайт перестанет принимать записи" };
  }
  try {
    await db.business.update({
      where: { id },
      data: {
        ...d,
        phone,
        // Сменили город, а пояс руками не трогали — пояс по новому городу. Выбранный вручную пояс главнее
        timezone: before.city !== d.city && d.timezone === before.timezone && isKnownCity(d.city) ? timezoneForCity(d.city) : d.timezone,
        yandexMapsUrl: d.yandexMapsUrl || null,
        twoGisUrl: d.twoGisUrl || null,
        rating: d.rating === "" ? null : d.rating,
        reviewsYandex: d.reviewsYandex === "" ? null : d.reviewsYandex,
        reviews2gis: d.reviews2gis === "" ? null : d.reviews2gis,
        operatorName: d.operatorName || null,
        operatorInn: d.operatorInn || null,
        customDomain: d.customDomain ? d.customDomain.toLowerCase() : null,
      },
    });
  } catch {
    return { error: "Такой домен уже привязан к другому сервису" };
  }
  await audit("admin.info_save", { userId: admin.id, businessId: id });
  revalidatePath(`/admin/b/${id}`);
  return { ok: true, message: "Сохранено" };
}

const LeadForm = z.object({
  status: z.enum(["new", "asked", "demo_sent", "replied", "interested", "trial", "paid", "refused"]),
  channel: z.string().max(40),
  contact: z.string().max(120),
  notes: z.string().max(2000),
});

export async function saveLead(id: string, _prev: AdminResult, f: FormData): Promise<AdminResult> {
  await requireAdmin();
  const p = LeadForm.safeParse(Object.fromEntries(["status", "channel", "contact", "notes"].map((k) => [k, str(f, k)])));
  if (!p.success) return { error: firstIssue(p.error, LABELS) };
  const prev = await db.lead.findUnique({ where: { businessId: id } });
  const contactedAt = p.data.status !== "new" && (!prev || prev.status === "new") ? new Date() : prev?.contactedAt;
  // Отказ: контакт для связи и текст первого сообщения стираются, демо закрывается (политика avtoslot.ru/privacy, п. 3.3).
  // Карточка с названием и отметкой «отказ» остаётся, чтобы не написать повторно, и удаляется очисткой через 12 месяцев (REFUSED_KEEP_DAYS)
  const refused = p.data.status === "refused";
  const data = refused ? { ...p.data, contact: null, firstMessage: null } : p.data;
  await db.lead.upsert({
    where: { businessId: id },
    create: { businessId: id, ...data, contactedAt },
    update: { ...data, contactedAt },
  });
  if (refused) {
    await db.business.updateMany({ where: { id, status: "demo" }, data: { status: "archived", demoExpiresAt: new Date() } });
  }
  revalidatePath("/admin", "layout");
  return { ok: true, message: refused ? "Сохранено. Контакт удалён, демо закрыто" : "Сохранено" };
}

/**
 * Подключение: вход для владельца, сайт выходит из демо и открывается поисковикам.
 * Пробного периода нет (решение 4 октября): сервис сразу «Активен», оплачено «до сегодня» — пока не записана оплата,
 * через UNPAID_GRACE_DAYS дней сайт приостановится сам (оферта, п. 4.1). Повторный вызов — новый пароль владельцу.
 */
export async function startTrial(id: string, _prev: AdminResult, f: FormData): Promise<AdminResult> {
  const admin = await requireAdmin();
  const phone = normalizePhone(str(f, "ownerPhone"));
  if (!phone) return { error: "Телефон владельца: 10 цифр после +7" };
  const biz = await db.business.findUniqueOrThrow({ where: { id }, include: { users: true } });
  // Живой сайт собирает персональные данные: в согласии оператором должен значиться ИП или ООО с ИНН
  const fromDemo = biz.status === "demo" || biz.status === "archived";
  if (!biz.operatorName || !biz.operatorInn) {
    return { error: "Сначала заполните «Оператор ПДн» и «ИНН оператора» на вкладке «Данные»: они попадают в согласие клиента" };
  }
  const existing = await db.user.findUnique({ where: { phone } });
  if (existing && existing.businessId !== id) return { error: "Этот телефон уже привязан к другому сервису" };
  const fixedSlug = /-$/.test(biz.slug) ? await uniqueSlug(biz.slug.replace(/-+$/, "") || "servis") : null;
  const password = generatePassword();
  const passwordHash = await hashPassword(password);
  await db.$transaction([
    existing
      ? db.user.update({ where: { id: existing.id }, data: { passwordHash, name: str(f, "ownerName") || existing.name } })
      : db.user.create({ data: { phone, passwordHash, role: "owner", businessId: id, name: str(f, "ownerName") || null } }),
    db.business.update({
      where: { id },
      data: {
        ...statusChange(fromDemo ? "active" : biz.status),
        demoExpiresAt: null,
        // Срок «до сегодня» и для вернувшегося архивного клиента: со старым сроком ночная проверка сразу приостановила бы сайт
        ...(fromDemo && (!biz.paidUntil || biz.paidUntil < new Date()) ? { paidUntil: new Date() } : {}),
        // Демо, созданные до исправления, могли получить адрес с дефисом на конце: поддомен с ним не откроется
        ...(fixedSlug ? { slug: fixedSlug } : {}),
      },
    }),
    // Этап «Подключён, ждёт оплату»; новый пароль уже подключённому клиенту этап не трогает
    db.lead.upsert({ where: { businessId: id }, create: { businessId: id, status: "trial" }, update: fromDemo ? { status: "trial" } : {} }),
    // Пробные записи из демо (владелец пробовал форму) не должны занимать время на живом сайте
    ...(biz.status === "demo" ? [db.booking.deleteMany({ where: { businessId: id } })] : []),
  ]);
  // Новый пароль: старые входы владельца больше не действуют
  if (existing) await endAllSessions(existing.id);
  await audit("admin.trial_start", { userId: admin.id, businessId: id });
  revalidatePath(`/admin/b/${id}`);
  return {
    ok: true,
    message: fromDemo
      ? `Сервис подключён. Пароль показан один раз: перешлите его владельцу. Запишите оплату подключения на вкладке «Оплаты», без неё через ${UNPAID_GRACE_DAYS} дней сайт приостановится`
      : "Новый пароль создан. Он показан один раз: перешлите его владельцу",
    password,
  };
}

export async function addPayment(id: string, _prev: AdminResult, f: FormData): Promise<AdminResult> {
  const admin = await requireAdmin();
  const amount = Number(str(f, "amount"));
  const months = Number(str(f, "months") || "0");
  if (!Number.isInteger(amount) || amount <= 0) return { error: "Укажите сумму в рублях" };
  const biz = await db.business.findUniqueOrThrow({ where: { id }, include: { _count: { select: { users: { where: { role: "owner" } } } } } });
  const blocked = connectFirst({ status: biz.status, owners: biz._count.users });
  if (blocked) return { error: blocked };
  const from = biz.paidUntil && biz.paidUntil > new Date() ? biz.paidUntil : new Date();
  const to = months > 0 ? addMonths(from, months) : null;
  await db.$transaction([
    db.payment.create({
      data: { businessId: id, amount, purpose: str(f, "purpose") || "Абонплата", periodFrom: to ? from : null, periodTo: to, receiptSent: f.get("receiptSent") === "on" },
    }),
    // Оплата без месяцев (например, разовая услуга) у приостановленного сайта: срок хотя бы с сегодняшнего дня, иначе ночью снова приостановка
    db.business.update({ where: { id }, data: { ...statusChange("active"), ...(to ? { paidUntil: to } : biz.paidUntil && biz.paidUntil > new Date() ? {} : { paidUntil: new Date() }) } }),
    db.lead.upsert({ where: { businessId: id }, create: { businessId: id, status: "paid" }, update: { status: "paid" } }),
  ]);
  await audit("admin.payment", { userId: admin.id, businessId: id, details: { amount } });
  revalidatePath(`/admin/b/${id}`);
  revalidatePath("/admin");
  return { ok: true, message: "Оплата записана. Не забудьте чек в «Мой налог»" };
}

export async function setReceiptSent(paymentId: string, bizId: string) {
  await requireAdmin();
  await db.payment.update({ where: { id: paymentId }, data: { receiptSent: true } });
  revalidatePath(`/admin/b/${bizId}`);
}

export async function setStatus(id: string, status: "demo" | "trial" | "active" | "suspended" | "archived") {
  const admin = await requireAdmin();
  const biz = await db.business.findUniqueOrThrow({ where: { id }, select: { paidUntil: true, status: true, _count: { select: { users: { where: { role: "owner" } } } } } });
  // Сайт без владельца (демо или архивное демо) живым не делаем: подключение только через «Создать вход»
  if ((status === "active" || status === "trial") && connectFirst({ status: biz.status, owners: biz._count.users })) {
    throw new Error("Сначала «Создать вход» на вкладке «Подключение»: без владельца сайт не включается");
  }
  // «Активировать» без новой оплаты: срок не раньше сегодняшнего, иначе ночная проверка тут же снова приостановит сайт
  const now = new Date();
  const paidFix = status === "active" && (!biz.paidUntil || biz.paidUntil < now) ? { paidUntil: now } : {};
  await db.business.update({
    where: { id },
    data: {
      ...statusChange(status, now),
      ...paidFix,
      ...(status === "demo" ? { demoExpiresAt: new Date(Date.now() + DEMO_DAYS * 86400000) } : {}),
    },
  });
  // В архив — входы владельца завершаются сразу, а не когда истечёт cookie
  if (status === "archived") await db.session.deleteMany({ where: { user: { businessId: id } } });
  await audit("admin.status", { userId: admin.id, businessId: id, details: { status } });
  revalidatePath(`/admin/b/${id}`);
  revalidatePath("/admin");
}

/** Отметка, что сервис подал уведомление в Роскомнадзор (дата и номер из ответа РКН, номер необязателен). */
export async function saveRkn(id: string, _prev: AdminResult, f: FormData): Promise<AdminResult> {
  const admin = await requireAdmin();
  const filed = str(f, "rknFiledAt");
  if (filed && !isDateString(filed)) return { error: "Дата подачи: выберите день" };
  await db.business.update({
    where: { id },
    data: { rknFiledAt: filed ? new Date(`${filed}T12:00:00Z`) : null, rknNumber: str(f, "rknNumber").slice(0, 60) || null },
  });
  await audit("admin.rkn_save", { userId: admin.id, businessId: id });
  revalidatePath(`/admin/b/${id}`);
  revalidatePath("/admin");
  return { ok: true, message: "Сохранено" };
}

/** Открыть кабинет сервиса от имени администратора: внести услуги, часы и посты при подключении. */
export async function openCabinet(id: string) {
  const admin = await requireAdmin();
  await db.business.findUniqueOrThrow({ where: { id }, select: { id: true } });
  await setAdminView(id);
  await audit("admin.open_cabinet", { userId: admin.id, businessId: id });
  redirect("/cabinet");
}

export async function closeCabinet() {
  const { asAdmin, business } = await requireOwner();
  if (!asAdmin) redirect("/cabinet");
  await setAdminView(null);
  redirect(`/admin/b/${business.id}`);
}

export async function extendDemo(id: string) {
  await requireAdmin();
  await db.business.update({ where: { id }, data: { demoExpiresAt: new Date(Date.now() + DEMO_DAYS * 86400000) } });
  revalidatePath(`/admin/b/${id}`);
}

export async function deleteBusiness(id: string) {
  const admin = await requireAdmin();
  const biz = await db.business.findUniqueOrThrow({ where: { id } });
  if (biz.status !== "demo" && biz.status !== "archived") throw new Error("Удалять можно только демо или архивные сервисы");
  await db.business.delete({ where: { id } });
  await audit("admin.delete", { userId: admin.id, details: { slug: biz.slug } });
  revalidatePath("/admin");
  redirect("/admin");
}

/** Удаление отмеченных на главной админки: только демо и архив, без отказов (canBulkDelete). */
export async function deleteBusinesses(_prev: AdminResult, f: FormData): Promise<AdminResult> {
  const admin = await requireAdmin();
  const ids = [...new Set(f.getAll("id").map(String))].slice(0, 300);
  if (!ids.length) return { error: "Отметьте сервисы, которые нужно удалить" };
  const found = await db.business.findMany({ where: { id: { in: ids } }, select: { id: true, slug: true, status: true, lead: { select: { status: true } } } });
  const ok = found.filter((b) => canBulkDelete(b.status, b.lead?.status));
  // Статус ещё раз в условии: если сервис успели подключить, пока список был открыт, он не удалится
  const { count } = await db.business.deleteMany({ where: { id: { in: ok.map((b) => b.id) }, status: { in: ["demo", "archived"] } } });
  for (const b of ok) await audit("admin.delete", { userId: admin.id, details: { slug: b.slug, bulk: true } });
  revalidatePath("/admin");
  const left = ids.length - count;
  return { ok: true, message: `Удалено: ${count}.${left ? ` Не удалено: ${left} (подключённые сервисы и отказы удаляются только из карточки).` : ""}` };
}
