"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { audit, generatePassword, hashPassword, requireAdmin } from "@/lib/auth";
import { isHexColor } from "@/lib/color";
import { THEME_KEYS } from "@/lib/themes";
import { db } from "@/lib/db";
import { normalizePhone } from "@/lib/phone";
import { RESERVED_SLUGS, slugify } from "@/lib/slug";
import { TRIAL_DAYS } from "@/lib/pricing";
import { DEFAULT_FACTS, DEFAULT_HOURS, TEMPLATES, type TemplateKey } from "@/lib/templates";

export type AdminResult = { ok?: boolean; error?: string; message?: string; password?: string; id?: string } | null;

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const optUrl = z.union([z.literal(""), z.string().url("Ссылка должна начинаться с https://")]);
const optInt = z.union([z.literal(""), z.coerce.number().int().min(0)]);

const DEMO_DAYS = 14;


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
  rating: z.union([z.literal(""), z.coerce.number().min(1).max(5)]),
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

/** Быстрое демо (раздел 2.3): 2-3 минуты от карточки на картах до персональной ссылки. */
export async function createDemo(_prev: AdminResult, f: FormData): Promise<AdminResult> {
  const admin = await requireAdmin();
  const p = Demo.safeParse(Object.fromEntries([...f.keys()].map((k) => [k, str(f, k)])));
  if (!p.success) return { error: p.error.issues[0].message };
  const d = p.data;
  const phone = normalizePhone(d.phone);
  if (!phone) return { error: "Телефон: 10 цифр после +7" };
  const slug = await uniqueSlug(slugify(d.name));
  const biz = await db.business.create({
    data: {
      slug,
      name: d.name,
      city: d.city,
      address: d.address,
      phone,
      yandexMapsUrl: d.yandexMapsUrl || null,
      twoGisUrl: d.twoGisUrl || null,
      rating: d.rating === "" ? null : d.rating,
      reviewsYandex: d.reviewsYandex === "" ? null : d.reviewsYandex,
      reviews2gis: d.reviews2gis === "" ? null : d.reviews2gis,
      theme: d.theme,
      accent: d.accent,
      posts: d.posts,
      headline: d.headline || null,
      facts: d.posts > 1 ? [{ value: `${d.posts} поста`, label: "можно приехать вдвоём" }, DEFAULT_FACTS[1]] : [DEFAULT_FACTS[1]],
      status: "demo",
      demoExpiresAt: new Date(Date.now() + DEMO_DAYS * 86400000),
      hours: { create: DEFAULT_HOURS },
      services: { create: TEMPLATES[d.template as TemplateKey].services.map((s, i) => ({ ...s, sortOrder: i })) },
      lead: { create: { status: "new", channel: d.channel || null, contact: d.contact || null } },
    },
  });
  await audit("admin.demo_create", { userId: admin.id, businessId: biz.id });
  revalidatePath("/admin");
  redirect(`/admin/b/${biz.id}?created=1`);
}

const Info = z.object({
  name: z.string().min(2),
  city: z.string().min(2),
  address: z.string().min(3),
  phone: z.string(),
  yandexMapsUrl: optUrl,
  twoGisUrl: optUrl,
  rating: z.union([z.literal(""), z.coerce.number().min(1).max(5)]),
  reviewsYandex: optInt,
  reviews2gis: optInt,
  theme: z.enum(THEME_KEYS),
  accent: z.string().refine(isHexColor, "Цвет в формате #1f9d55"),
  logoLetter: z.string().max(2),
  operatorName: z.string().max(120),
  operatorInn: z.union([z.literal(""), z.string().regex(/^\d{10}(\d{2})?$/, "ИНН: 10 или 12 цифр")]),
  customDomain: z.union([z.literal(""), z.string().regex(/^[a-z0-9.-]+\.[a-z]{2,}$/i, "Домен вида avtoservis-ivanov.ru")]),
});

export async function saveInfo(id: string, _prev: AdminResult, f: FormData): Promise<AdminResult> {
  const admin = await requireAdmin();
  const p = Info.safeParse(Object.fromEntries([...f.keys()].map((k) => [k, str(f, k)])));
  if (!p.success) return { error: p.error.issues[0].message };
  const d = p.data;
  const phone = normalizePhone(d.phone);
  if (!phone) return { error: "Телефон: 10 цифр после +7" };
  try {
    await db.business.update({
      where: { id },
      data: {
        ...d,
        phone,
        yandexMapsUrl: d.yandexMapsUrl || null,
        twoGisUrl: d.twoGisUrl || null,
        rating: d.rating === "" ? null : d.rating,
        reviewsYandex: d.reviewsYandex === "" ? null : d.reviewsYandex,
        reviews2gis: d.reviews2gis === "" ? null : d.reviews2gis,
        logoLetter: d.logoLetter || null,
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
  status: z.enum(["new", "demo_sent", "replied", "interested", "trial", "paid", "refused"]),
  channel: z.string().max(40),
  contact: z.string().max(120),
  notes: z.string().max(2000),
});

export async function saveLead(id: string, _prev: AdminResult, f: FormData): Promise<AdminResult> {
  await requireAdmin();
  const p = LeadForm.safeParse(Object.fromEntries(["status", "channel", "contact", "notes"].map((k) => [k, str(f, k)])));
  if (!p.success) return { error: p.error.issues[0].message };
  const prev = await db.lead.findUnique({ where: { businessId: id } });
  const contactedAt = p.data.status !== "new" && (!prev || prev.status === "new") ? new Date() : prev?.contactedAt;
  await db.lead.upsert({
    where: { businessId: id },
    create: { businessId: id, ...p.data, contactedAt },
    update: { ...p.data, contactedAt },
  });
  revalidatePath("/admin", "layout");
  return { ok: true, message: "Сохранено" };
}

/** Демо → пробный период: вход для владельца, индексация, срок 14 дней (раздел 2.3, п. 3). */
export async function startTrial(id: string, _prev: AdminResult, f: FormData): Promise<AdminResult> {
  const admin = await requireAdmin();
  const phone = normalizePhone(str(f, "ownerPhone"));
  if (!phone) return { error: "Телефон владельца: 10 цифр после +7" };
  const biz = await db.business.findUniqueOrThrow({ where: { id }, include: { users: true } });
  const existing = await db.user.findUnique({ where: { phone } });
  if (existing && existing.businessId !== id) return { error: "Этот телефон уже привязан к другому сервису" };
  const password = generatePassword();
  const passwordHash = await hashPassword(password);
  await db.$transaction([
    existing
      ? db.user.update({ where: { id: existing.id }, data: { passwordHash, name: str(f, "ownerName") || existing.name } })
      : db.user.create({ data: { phone, passwordHash, role: "owner", businessId: id, name: str(f, "ownerName") || null } }),
    db.business.update({
      where: { id },
      data: { status: biz.status === "demo" ? "trial" : biz.status, demoExpiresAt: null, trialEndsAt: biz.trialEndsAt ?? new Date(Date.now() + TRIAL_DAYS * 86400000) },
    }),
    db.lead.upsert({ where: { businessId: id }, create: { businessId: id, status: "trial" }, update: { status: "trial" } }),
  ]);
  await audit("admin.trial_start", { userId: admin.id, businessId: id });
  revalidatePath(`/admin/b/${id}`);
  return { ok: true, message: "Вход создан. Пароль показан один раз: перешлите его владельцу", password };
}

export async function addPayment(id: string, _prev: AdminResult, f: FormData): Promise<AdminResult> {
  const admin = await requireAdmin();
  const amount = Number(str(f, "amount"));
  const months = Number(str(f, "months") || "0");
  if (!Number.isInteger(amount) || amount <= 0) return { error: "Укажите сумму в рублях" };
  const biz = await db.business.findUniqueOrThrow({ where: { id } });
  const from = biz.paidUntil && biz.paidUntil > new Date() ? biz.paidUntil : new Date();
  const to = months > 0 ? new Date(new Date(from).setMonth(from.getMonth() + months)) : null;
  await db.$transaction([
    db.payment.create({
      data: { businessId: id, amount, purpose: str(f, "purpose") || "Абонплата", periodFrom: to ? from : null, periodTo: to, receiptSent: f.get("receiptSent") === "on" },
    }),
    db.business.update({ where: { id }, data: { status: "active", ...(to ? { paidUntil: to } : {}) } }),
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
  await db.business.update({
    where: { id },
    data: { status, ...(status === "demo" ? { demoExpiresAt: new Date(Date.now() + DEMO_DAYS * 86400000) } : {}) },
  });
  await audit("admin.status", { userId: admin.id, businessId: id, details: { status } });
  revalidatePath(`/admin/b/${id}`);
  revalidatePath("/admin");
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
