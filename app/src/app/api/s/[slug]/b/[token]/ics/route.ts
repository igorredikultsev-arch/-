import { getSiteBusiness } from "@/lib/business";
import { db } from "@/lib/db";

const esc = (s: string) => s.replace(/[\\,;]/g, (c) => `\\${c}`).replace(/\n/g, "\\n");
const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

/** Файл для календаря телефона: «Добавить в календарь» на экране записи. */
export async function GET(_req: Request, ctx: { params: Promise<{ slug: string; token: string }> }) {
  const { slug, token } = await ctx.params;
  const biz = await getSiteBusiness(decodeURIComponent(slug));
  const b = await db.booking.findUnique({ where: { cancelToken: token }, include: { business: true } });
  if (!biz || !b || b.businessId !== biz.id || b.status !== "active") return new Response("Запись не найдена", { status: 404 });
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
