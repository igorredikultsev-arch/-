"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { audit, createSession, destroySession, hashPassword, verifyPassword } from "@/lib/auth";
import { db } from "@/lib/db";
import { normalizePhone } from "@/lib/phone";
import { hit } from "@/lib/ratelimit";
import { clientIp } from "@/lib/request";
import { sha256 } from "@/lib/tokens";

// Метка «на этом устройстве уже входили»: хэш от хэша пароля, подделать её без базы нельзя, со сменой пароля она перестаёт подходить
const DEVICE_COOKIE = "as_device";
const deviceMark = (phone: string, passwordHash: string) => sha256(`${phone}:${passwordHash}`).slice(0, 32);

// Хэш-пустышка: для несуществующего номера пароль всё равно проверяется, чтобы по времени ответа нельзя было узнать, есть ли такой владелец
let dummy: Promise<string> | null = null;

export async function loginAction(_prev: string | null, form: FormData): Promise<string | null> {
  const phone = normalizePhone(String(form.get("phone") || ""));
  const password = String(form.get("password") || "");
  if (!phone || !password) return "Введите телефон и пароль";

  // Лимиты: с одного адреса и на номер с одного адреса (чужой не может заблокировать владельцу вход своими попытками).
  // Общий потолок неудачных попыток на номер за час останавливает перебор с разных адресов, но не мешает устройствам,
  // с которых владелец уже входил: иначе чужой человек, зная номер с вывески, мог бы закрыть владельцу вход
  const ip = (await clientIp()) ?? "unknown";
  const okIp = await hit(`login:ip:${ip}`, 20, 900);
  const okPair = await hit(`login:phone-ip:${phone}:${ip}`, 8, 900);
  if (!okIp || !okPair) return "Слишком много попыток. Подождите 15 минут";

  const user = await db.user.findUnique({ where: { phone } });
  const store = await cookies();
  const knownDevice = !!user && store.get(DEVICE_COOKIE)?.value === deviceMark(phone, user.passwordHash);
  const failKey = `login:fail:${phone}`;
  if (!knownDevice) {
    const row = await db.rateLimit.findUnique({ where: { key: failKey } });
    if (row && row.count >= 40 && row.windowStart.getTime() > Date.now() - 3600000) return "Слишком много попыток входа на этот номер. Подождите час";
  }

  const ok = user ? await verifyPassword(user.passwordHash, password) : await verifyPassword(await (dummy ??= hashPassword("dummy-password")), password);
  if (!user || !ok) {
    await hit(failKey, 40, 3600);
    return "Неверный телефон или пароль";
  }

  if (user.businessId && (await db.business.findUnique({ where: { id: user.businessId }, select: { status: true } }))?.status === "archived") {
    return "Сервис отключён, вход в кабинет закрыт. Если это ошибка, напишите тому, кто подключал сервис";
  }

  await createSession(user.id);
  store.set(DEVICE_COOKIE, deviceMark(phone, user.passwordHash), {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/login", maxAge: 365 * 86400,
  });
  await audit("login", { userId: user.id, businessId: user.businessId ?? undefined });
  redirect(user.role === "admin" ? "/admin" : "/cabinet");
}

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}
