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
