import { getSiteBusiness, decodeKey } from "@/lib/business";
import { db } from "@/lib/db";
import { siteBase } from "@/lib/site-url";

const esc = (s: string) => s.replace(/[\\,;]/g, (c) => `\\${c}`).replace(/\r?\n|\r/g, "\\n");
const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

/** Файл для календаря телефона: «Добавить в календарь» на экране записи. */
export async function GET(req: Request, ctx: { params: Promise<{ slug: string; token: string }> }) {
  const { slug, token } = await ctx.params;
  const key = decodeKey(slug);
  const biz = await getSiteBusiness(key);
  const b = await db.booking.findUnique({ where: { cancelToken: token }, include: { business: true } });
  if (!biz || !b || b.businessId !== biz.id || b.status !== "active") return new Response("Запись не найдена", { status: 404 });
  // Ссылка на страницу записи: из календаря её можно открыть и отменить, даже если вкладку давно закрыли
  const url = `${req.headers.get("x-forwarded-proto") ?? "https"}://${req.headers.get("host")}${await siteBase(key)}/b/${token}`;
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Avtoslot//RU",
    "BEGIN:VEVENT",
    `UID:${b.id}@avtoslot`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(b.startAt)}`,
    `DTEND:${stamp(b.endAt)}`,
    `SUMMARY:${esc(`${b.serviceName}, ${b.business.name}`)}`,
    `LOCATION:${esc(`${b.business.city}, ${b.business.address}`)}`,
    `URL:${url}`,
    `DESCRIPTION:${esc(`Изменить или отменить запись: ${url}`)}`,
    "BEGIN:VALARM",
    "TRIGGER:-PT2H",
    "ACTION:DISPLAY",
    `DESCRIPTION:${esc(b.serviceName)}`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
  return new Response(ics, {
    headers: { "Content-Type": "text/calendar; charset=utf-8", "Content-Disposition": 'attachment; filename="zapis.ics"' },
  });
}
