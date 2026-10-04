import type { NextRequest } from "next/server";
import { z } from "zod";
import "@/lib/zod-ru";
import { Prisma } from "@prisma/client";
import { BookingError, createSiteBooking } from "@/lib/booking";
import { verifyCaptcha } from "@/lib/captcha";
import { formatPhone, normalizePhone } from "@/lib/phone";
import { hit } from "@/lib/ratelimit";
import { operatorMissing, strictWithoutCaptcha } from "@/lib/readiness";
import { clientIp } from "@/lib/request";
import { json, notFound, publicBusiness } from "@/lib/site-api";
import { isDateString } from "@/lib/time";

const Body = z.object({
  serviceId: z.string().min(1),
  date: z.string().refine(isDateString),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  name: z.string().trim().min(1, "Укажите имя").max(60),
  phone: z.string().max(30),
  car: z.string().trim().min(2, "Укажите марку и модель").max(60),
  comment: z.string().trim().max(500).optional().default(""),
  consent: z.literal(true, { error: "Без согласия на обработку данных записаться нельзя" }),
  captcha: z.string().optional(),
  website: z.string().optional(), // ловушка для ботов: люди это поле не видят
});

// Одна будущая запись на номер в одном сервисе: с одного телефона нельзя занять всё расписание.
// Вторую машину записывают по телефону или после первого визита
const MAX_ACTIVE_PER_PHONE = 1;

export async function POST(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const biz = await publicBusiness((await ctx.params).slug);
  if (!biz) return notFound();
  if (operatorMissing(biz)) {
    return json({ error: `Онлайн-запись временно недоступна. Позвоните в сервис: ${formatPhone(biz.phone)}` }, 503);
  }

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const i of parsed.error.issues) fields[String(i.path[0])] ??= i.message;
    return json({ error: "Проверьте поля формы", fields }, 400);
  }
  const b = parsed.data;
  if (b.website) return json({ error: "Не удалось записаться" }, 400);

  const phone = normalizePhone(b.phone);
  if (!phone) return json({ error: "Проверьте поля формы", fields: { phone: "Нужен российский номер из 10 цифр после +7" } }, 400);

  const service = biz.services.find((s) => s.id === b.serviceId);
  if (service?.isDiagnostic && b.comment.length < 5) {
    return json({ error: "Проверьте поля формы", fields: { comment: "Опишите, что беспокоит в машине" } }, 400);
  }

  const ip = await clientIp();
  if (ip && !(await hit(`booking:ip:${ip}`, 10, 3600))) {
    return json({ error: "Слишком много записей с этого устройства. Попробуйте через час или позвоните в сервис" }, 429);
  }
  const captcha = await verifyCaptcha(b.captcha, ip);
  if (captcha === "fail") return json({ error: "Подтвердите, что вы не робот" }, 400);
  // Сервис капчи не ответил или капча не настроена на сервере: запись не теряем, но с одного адреса пускаем реже
  const noCaptcha = captcha === "unavailable" || (captcha === "off" && strictWithoutCaptcha());
  if (noCaptcha && ip && !(await hit(`booking:nocaptcha:${ip}`, 3, 3600))) {
    return json({ error: "Не получилось проверить, что вы не робот. Попробуйте позже или позвоните в сервис" }, 429);
  }

  try {
    const booking = await createSiteBooking({
      businessId: biz.id,
      serviceId: b.serviceId,
      date: b.date,
      time: b.time,
      clientName: b.name,
      clientPhone: phone,
      car: b.car,
      comment: b.comment,
      consentIp: ip,
      maxActivePerPhone: MAX_ACTIVE_PER_PHONE,
      withoutPersonalData: biz.status === "demo",
    });
    return json({ token: booking.cancelToken }, 201);
  } catch (e) {
    if (e instanceof BookingError) return json({ error: e.message, code: e.code }, e.code === "slot_taken" || e.code === "too_many" ? 409 : 400);
    // Наплыв записей: очередь к базе не дождалась. Двойной записи не будет, просим повторить
    if (e instanceof Prisma.PrismaClientKnownRequestError && (e.code === "P2028" || e.code === "P2034")) {
      return json({ error: "Сейчас много записей одновременно. Нажмите «Записаться» ещё раз" }, 503);
    }
    throw e;
  }
}
