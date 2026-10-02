"use server";

import { redirect } from "next/navigation";
import { audit, createSession, destroySession, verifyPassword } from "@/lib/auth";
import { db } from "@/lib/db";
import { normalizePhone } from "@/lib/phone";
import { hit } from "@/lib/ratelimit";
import { clientIp } from "@/lib/request";

export async function loginAction(_prev: string | null, form: FormData): Promise<string | null> {
  const phone = normalizePhone(String(form.get("phone") || ""));
  const password = String(form.get("password") || "");
  if (!phone || !password) return "Введите телефон и пароль";

  const ip = (await clientIp()) ?? "unknown";
  const okIp = await hit(`login:ip:${ip}`, 20, 900);
  const okPhone = await hit(`login:phone:${phone}`, 8, 900);
  if (!okIp || !okPhone) return "Слишком много попыток. Подождите 15 минут";

  const user = await db.user.findUnique({ where: { phone } });
  const ok = user ? await verifyPassword(user.passwordHash, password) : false;
  if (!user || !ok) return "Неверный телефон или пароль";

  await createSession(user.id);
  await audit("login", { userId: user.id, businessId: user.businessId ?? undefined });
  redirect(user.role === "admin" ? "/admin" : "/cabinet");
}

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}
