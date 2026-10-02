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

export const getSessionUser = cache(async () => {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const s = await db.session.findUnique({ where: { id: sha256(token) }, include: { user: true } });
  if (!s || s.expiresAt.getTime() < Date.now()) return null;
  return s.user;
});

/** Владелец с его сервисом. Без входа — на страницу входа. */
export const requireOwner = cache(async () => {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role === "admin" && !user.businessId) redirect("/admin");
  if (!user.businessId) redirect("/login");
  const business = await db.business.findUnique({ where: { id: user.businessId } });
  if (!business) redirect("/login");
  return { user, business };
});

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
