// Новые записи с сайта, свежие сверху (просьба «Конкурента» 29 октября): уведомление смахнули — запись находится здесь
import Link from "next/link";
import { Phone } from "@phosphor-icons/react/dist/ssr";
import { requireOwner } from "@/lib/auth";
import { db } from "@/lib/db";
import { addDays, formatDateTime, formatDayShort, hhmm, toLocal } from "@/lib/time";
import { Card, SubHead } from "../ui";

const RECENT_DAYS = 14;
const STATUS_LABEL = { cancelled: "отменена", no_show: "не приехал", done: "выполнена" } as const;

export default async function RecentPage() {
  const { business } = await requireOwner();
  const tz = business.timezone;
  const bookings = await db.booking.findMany({
    where: { businessId: business.id, source: "site", createdAt: { gte: new Date(Date.now() - RECENT_DAYS * 86400000) } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  const today = toLocal(Date.now(), tz).date;
  // «сегодня в 14:05», «вчера в 9:12», «27 октября в 10:00»
  const made = (d: Date) => {
    const l = toLocal(d.getTime(), tz);
    const f = formatDayShort(l.date);
    const day = l.date === today ? "сегодня" : l.date === addDays(today, -1) ? "вчера" : `${f.day} ${f.month}`;
    return `${day} в ${hhmm(l.minutes)}`;
  };
  return (
    <>
      <SubHead back="/cabinet" backLabel="Сегодня" title="Новые записи с сайта">
        Кто записался за последние {RECENT_DAYS} дней, свежие сверху
      </SubHead>
      <div className="grid gap-2 px-3.5 lg:px-0">
        {bookings.length === 0 && <Card className="p-5 text-center text-[15px] text-zinc-600">За {RECENT_DAYS} дней записей с сайта не было.</Card>}
        {bookings.map((b) => (
          <div key={b.id} className={`grid grid-cols-[1fr_42px] items-center gap-2.5 rounded-[14px] border border-zinc-200 bg-white p-3 ${b.status === "cancelled" ? "opacity-55" : ""}`}>
            <Link href={`/cabinet/b/${b.id}`} className="min-w-0">
              <div className="text-[12.5px] text-zinc-500">Записался {made(b.createdAt)}</div>
              <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[15px] font-semibold">
                {formatDateTime(b.startAt.getTime(), tz)}
                {b.status !== "active" && <span className="text-[11px] font-semibold text-red-700">{STATUS_LABEL[b.status]}</span>}
              </div>
              <div className="mt-0.5 text-[13px] leading-snug text-zinc-500">
                {[b.clientName || "Без имени", b.car, b.serviceName].filter(Boolean).join(", ")}
              </div>
            </Link>
            {b.clientPhone ? (
              <a href={`tel:${b.clientPhone}`} aria-label={`Позвонить: ${b.clientName || "клиент"}`} className="grid size-[42px] place-items-center rounded-full bg-emerald-50 text-emerald-700">
                <Phone size={19} />
              </a>
            ) : (
              <span />
            )}
          </div>
        ))}
      </div>
    </>
  );
}
