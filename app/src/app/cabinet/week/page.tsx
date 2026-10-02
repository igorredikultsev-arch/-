import Link from "next/link";
import { CaretLeft, CaretRight } from "@phosphor-icons/react/dist/ssr";
import { requireOwner } from "@/lib/auth";
import { loadWeek } from "@/lib/cabinet";
import { addDays, formatDayLong, hhmm, isDateString, toLocal, weekdayOf } from "@/lib/time";
import { Card, PageHead } from "../ui";

export default async function WeekPage({ searchParams }: { searchParams: Promise<{ start?: string }> }) {
  const { business } = await requireOwner();
  const today = toLocal(Date.now(), business.timezone).date;
  const q = (await searchParams).start;
  const monday = addDays(today, 1 - weekdayOf(today));
  const start = q && isDateString(q) ? q : monday;
  const week = await loadWeek(business, start);
  const total = week.reduce((s, d) => s + d.bookings.length, 0);
  const site = week.reduce((s, d) => s + d.fromSite, 0);
  return (
    <>
      <PageHead kicker={`${formatDayLong(start)} и 6 дней`} title="Неделя">
        <div className="mt-1 flex items-center gap-2">
          <Link href={`/cabinet/week?start=${addDays(start, -7)}`} aria-label="Прошлая неделя" className="grid size-10 place-items-center rounded-full bg-white ring-1 ring-zinc-200"><CaretLeft size={18} /></Link>
          <Link href={`/cabinet/week?start=${addDays(start, 7)}`} aria-label="Следующая неделя" className="grid size-10 place-items-center rounded-full bg-white ring-1 ring-zinc-200"><CaretRight size={18} /></Link>
          <span className="ml-2 text-[14px] text-zinc-600">{total} записей, из них с сайта {site}</span>
        </div>
      </PageHead>
      <div className="grid gap-2 px-3.5">
        {week.map((d) => (
          <Link key={d.date} href={`/cabinet?date=${d.date}`}>
            <Card className={`grid gap-1.5 p-3.5 ${d.date === today ? "ring-2 ring-accent" : ""}`}>
              <div className="flex items-baseline justify-between">
                <b className="text-[15px]">{formatDayLong(d.date)}</b>
                <span className="text-[13px] text-zinc-500">{d.isWorkday ? `${d.bookings.length} зап.` : "выходной"}</span>
              </div>
              {d.bookings.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {d.bookings.map((b) => (
                    <span key={b.id} className={`rounded-md px-1.5 py-0.5 text-[12px] font-semibold ${b.source === "site" ? "bg-orange-50 text-orange-800" : "bg-zinc-100 text-zinc-700"}`}>
                      {hhmm(toLocal(b.startAt.getTime(), business.timezone).minutes)}
                    </span>
                  ))}
                </div>
              )}
            </Card>
          </Link>
        ))}
      </div>
    </>
  );
}
