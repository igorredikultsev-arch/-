// Вход владельца и администратора: телефон + пароль (раздел 1 плана).
// В cookie лежит случайный токен, в базе — только его sha256. Пароли — argon2.
import { hash, verify } from "@node-rs/argon2";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db } from "./db";
import { newToken, sha256 } from "./tokens";

const COOKIE = "as_session";
const SESSION_DAYS = 30;
// Какой кабинет открыл администратор (кнопка «Открыть кабинет владельца»). Действует только вместе со входом администратора
const VIEW_COOKIE = "as_view";

export const hashPassword = (p: string) => hash(p);

const COMMON = ["12345678", "123456789", "1234567890", "qwertyui", "qwerty123", "password", "11111111", "00000000", "87654321", "йцукенгш", "пароль123"];

/** Почему новый пароль не подходит, или null. Простые и состоящие из номера телефона подбираются за минуты. */
export function passwordProblem(p: string, phone: string): string | null {
  if (p.length < 8) return "Новый пароль: не меньше 8 символов";
  const low = p.toLowerCase();
  if (COMMON.some((c) => low.includes(c)) || /^(.)\1+$/.test(p)) return "Слишком простой пароль: такие подбирают первыми. Добавьте буквы и цифры вразброс";
  const digits = phone.replace(/\D/g, "").slice(-10);
  if (digits && p.replace(/\D/g, "").includes(digits.slice(-7))) return "Пароль не должен содержать номер телефона";
  return null;
}
export const verifyPassword = (h: string, p: string) => verify(h, p).catch(() => false);

/** Пароль для нового владельца: легко продиктовать, трудно подобрать. */
export function generatePassword(): string {
  const alphabet = "abcdefghjkmnpqrstuvwxyz23456789";
  const bytes = newToken(16);
  let out = "";
  for (let i = 0; i < 12; i++) out += alphabet[bytes.charCodeAt(i) % alphabet.length];
  return `${out.slice(0, 4)}-${out.slice(4, 8)}-${out.slice(8, 12)}`;
}

export async function createSession(userId: string) {
  const token = newToken(32);
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400000);
  await db.session.create({ data: { id: sha256(token), userId, expiresAt } });
  await db.user.update({ where: { id: userId }, data: { lastLoginAt: new Date() } });
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession() {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (token) await db.session.deleteMany({ where: { id: sha256(token) } });
  store.delete(COOKIE);
}

/** Завершить все входы пользователя, кроме текущего (после смены пароля). */
export async function endOtherSessions(userId: string) {
  const token = (await cookies()).get(COOKIE)?.value;
  await db.session.deleteMany({ where: { userId, ...(token ? { id: { not: sha256(token) } } : {}) } });
}

/** Завершить все входы пользователя (админ выдал владельцу новый пароль). */
export async function endAllSessions(userId: string) {
  await db.session.deleteMany({ where: { userId } });
}

export const getSessionUser = cache(async () => {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const s = await db.session.findUnique({ where: { id: sha256(token) }, include: { user: true } });
  if (!s || s.expiresAt.getTime() < Date.now()) return null;
  return s.user;
});

/**
 * Владелец с его сервисом. Без входа — на страницу входа.
 * Администратор попадает в кабинет сервиса, который открыл из админки (asAdmin: true), иначе — в админку.
 */
export const requireOwner = cache(async () => {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role === "admin") {
    const viewId = (await cookies()).get(VIEW_COOKIE)?.value;
    const viewed = viewId ? await db.business.findUnique({ where: { id: viewId } }) : null;
    if (viewed) return { user, business: viewed, asAdmin: true };
    if (!user.businessId) redirect("/admin");
  }
  if (!user.businessId) redirect("/login");
  const business = await db.business.findUnique({ where: { id: user.businessId } });
  if (!business) redirect("/login");
  // Договор закончился, сервис в архиве: кабинет с данными клиентов владельцу больше не доступен (оферта, п. 7.7)
  if (business.status === "archived") redirect("/login?closed=1");
  return { user, business, asAdmin: false };
});

/** Администратор открывает кабинет сервиса (или закрывает, null). Проверку прав делает вызывающий код. */
export async function setAdminView(businessId: string | null) {
  const store = await cookies();
  if (!businessId) {
    store.delete(VIEW_COOKIE);
    return;
  }
  store.set(VIEW_COOKIE, businessId, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 8 * 3600 });
}

export const requireAdmin = cache(async () => {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role !== "admin") redirect("/cabinet");
  return user;
});

export async function audit(action: string, opts: { userId?: string; businessId?: string; details?: Record<string, unknown> } = {}) {
  await db.auditLog.create({
    data: { action, userId: opts.userId, businessId: opts.businessId, details: (opts.details ?? undefined) as never },
  });
}
