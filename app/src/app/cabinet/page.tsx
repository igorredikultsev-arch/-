import Link from "next/link";
import { CaretLeft, CaretRight, Phone } from "@phosphor-icons/react/dist/ssr";
import { requireOwner } from "@/lib/auth";
import { loadDayForOwner, partOfDay, timeline } from "@/lib/cabinet";
import { addDays, formatDayLong, hhmm, isDateString, toLocal } from "@/lib/time";
import { Card, PageHead, Tag } from "./ui";

const STATUS_LABEL = { cancelled: "отменена", no_show: "не приехал", done: "выполнена" } as const;

export default async function TodayPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const { business } = await requireOwner();
  const tz = business.timezone;
  const today = toLocal(Date.now(), tz).date;
  const q = (await searchParams).date;
  const date = q && isDateString(q) ? q : today;
  const day = await loadDayForOwner(business, date);
  const title = date === today ? "Сегодня" : date === addDays(today, 1) ? "Завтра" : date === addDays(today, -1) ? "Вчера" : formatDayLong(date).split(",")[1].trim();
  const entries = timeline(day);
  // Подписи часов по месту на шкале: сервис может открываться не ровно в час (8:30)
  const span = Math.max(day.closeMin - day.openMin, 1);
  const hours: number[] = [];
  for (let h = Math.ceil(day.openMin / 60); h * 60 < day.closeMin; h++) hours.push(h);
  const nowMs = Date.now();

  let lastPart = "";
  return (
    <>
      <PageHead kicker={formatDayLong(date)} title={title}>
        <div className="mt-1 flex gap-2">
          <Link href={`/cabinet?date=${addDays(date, -1)}`} aria-label="Предыдущий день" className="grid size-10 place-items-center rounded-full bg-white text-zinc-600 ring-1 ring-zinc-200">
            <CaretLeft size={18} />
          </Link>
          <Link href={`/cabinet?date=${addDays(date, 1)}`} aria-label="Следующий день" className="grid size-10 place-items-center rounded-full bg-white text-zinc-600 ring-1 ring-zinc-200">
            <CaretRight size={18} />
          </Link>
          <Link href="/cabinet/block" className="grid h-10 place-items-center rounded-full bg-white px-4 text-sm font-semibold ring-1 ring-zinc-200">
            Закрыть время
          </Link>
          {date !== today && (
            <Link href="/cabinet" className="grid h-10 place-items-center rounded-full bg-white px-4 text-sm font-semibold ring-1 ring-zinc-200">
              Сегодня
            </Link>
          )}
        </div>
        <div className="mt-4 grid grid-cols-[.8fr_.8fr_1.4fr] gap-2">
          <Card className="grid gap-0.5 p-3">
            <b className="text-[21px] leading-none">{day.stats.total}</b>
            <span className="text-[11.5px] text-zinc-500">записей</span>
          </Card>
          <Card className="grid gap-0.5 p-3">
            <b className="text-[21px] leading-none">{day.stats.fromSite}</b>
            <span className="text-[11.5px] text-zinc-500">с сайта</span>
          </Card>
          <Card className="grid gap-0.5 p-3">
            <b className="whitespace-nowrap text-[21px] leading-none">{day.stats.revenue.toLocaleString("ru-RU")} ₽</b>
            <span className="text-[11.5px] text-zinc-500">выручка, примерно</span>
          </Card>
        </div>
      </PageHead>

      {day.isWorkday ? (
        <Card className="mx-3.5 p-3.5">
          <div className="mb-3 flex justify-between text-[13px]">
            <b>Загрузка постов</b>
            <span className="text-zinc-500">
              {hhmm(day.openMin)}-{hhmm(day.closeMin)}
            </span>
          </div>
          <div className="grid gap-[7px]">
            {day.lanes.map((lane, i) => (
              <div key={i} className="grid grid-cols-[48px_1fr] items-center gap-2 text-[11.5px] text-zinc-500">
                Пост {i + 1}
                <div className="relative h-[22px] rounded-md bg-zinc-100">
                  {day.closedAll.map((c, j) => (
                    <i key={`c${j}`} className="absolute inset-y-0.5 rounded-[5px] bg-[repeating-linear-gradient(45deg,#c3c9d0_0_3px,transparent_3px_6px)]" style={{ left: `${c.startPct}%`, width: `${c.widthPct}%` }} />
                  ))}
                  {lane.map((it, j) => (
                    <i
                      key={j}
                      className={`absolute inset-y-0.5 rounded-[5px] ${it.kind === "site" ? "bg-accent" : it.kind === "owner" ? "bg-zinc-700" : "bg-[repeating-linear-gradient(45deg,#c3c9d0_0_3px,transparent_3px_6px)]"} ${it.overflow ? "ring-2 ring-red-500" : ""}`}
                      style={{ left: `${it.startPct}%`, width: `${it.widthPct}%` }}
                    />
                  ))}
                  {day.nowPct != null && <span className="absolute -inset-y-[5px] w-0.5 rounded-sm bg-red-500" style={{ left: `${day.nowPct}%` }} />}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-1.5 grid grid-cols-[48px_1fr] gap-2 text-[10px] text-zinc-500">
            <span />
            <div className="relative h-3">
              {hours.map((h) => (
                <span key={h} className="absolute top-0 -translate-x-1/2" style={{ left: `${((h * 60 - day.openMin) / span) * 100}%` }}>{h}</span>
              ))}
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-x-3.5 gap-y-1.5 text-[11.5px] text-zinc-500">
            <span className="inline-flex items-center gap-1.5"><i className="size-3 rounded-[3px] bg-accent" />с сайта</span>
            <span className="inline-flex items-center gap-1.5"><i className="size-3 rounded-[3px] bg-zinc-700" />по телефону</span>
            <span className="inline-flex items-center gap-1.5"><i className="size-3 rounded-[3px] bg-[repeating-linear-gradient(45deg,#c3c9d0_0_3px,transparent_3px_6px)]" />закрыто</span>
          </div>
        </Card>
      ) : (
        <Card className="mx-3.5 p-4 text-[14px] text-zinc-600">Выходной по графику. Записи с сайта в этот день не принимаются.</Card>
      )}

      <div className="grid gap-2 px-3.5 pt-4">
        {entries.length === 0 && (
          <Card className="grid gap-3 p-5 text-center">
            <p className="text-[15px] text-zinc-600">На этот день записей нет.</p>
            <Link href={`/cabinet/new?date=${date}`} className="font-semibold text-accent underline underline-offset-4">
              Записать клиента
            </Link>
          </Card>
        )}
        {entries.map((e) => {
          const part = partOfDay(e.at, tz);
          const head = part !== lastPart ? <h2 key={`h${e.at}${part}`} className="px-1 pt-2 text-[13px] font-semibold text-zinc-500">{part}</h2> : null;
          lastPart = part;
          if (e.type === "lunch") {
            return (
              <div key={`lunch${e.at}`} className="contents">
                {head}
                <Link href="/cabinet/site#hours" className="grid grid-cols-[56px_1fr] items-center gap-2.5 rounded-[14px] border border-zinc-200 bg-[repeating-linear-gradient(45deg,#fff_0_9px,#eef0f3_9px_18px)] p-3">
                  <div className="text-[16.5px] font-bold">
                    {hhmm(toLocal(e.at, tz).minutes)}
                    <small className="block text-[11.5px] font-medium text-zinc-500">{Math.round((e.end - e.at) / 60000)} мин</small>
                  </div>
                  <div>
                    <div className="text-[15px] font-semibold">Обед</div>
                    <div className="mt-0.5 text-[13px] text-zinc-500">По часам работы, каждый день</div>
                  </div>
                </Link>
              </div>
            );
          }
          if (e.type === "block") {
            const b = e.block;
            const s = toLocal(b.startAt.getTime(), tz);
            return (
              <div key={b.id} className="contents">
                {head}
                <Link href="/cabinet/block" className="grid grid-cols-[56px_1fr] items-center gap-2.5 rounded-[14px] border border-zinc-200 bg-[repeating-linear-gradient(45deg,#fff_0_9px,#eef0f3_9px_18px)] p-3">
                  <div className="text-[16.5px] font-bold">
                    {hhmm(s.minutes)}
                    <small className="block text-[11.5px] font-medium text-zinc-500">{Math.round((b.endAt.getTime() - b.startAt.getTime()) / 60000)} мин</small>
                  </div>
                  <div>
                    <div className="text-[15px] font-semibold">{b.reason || "Закрыто"}</div>
                    <div className="mt-0.5 text-[13px] text-zinc-500">{b.scope === "all" ? "Закрыт весь сервис" : "Закрыт один пост"}</div>
                  </div>
                </Link>
              </div>
            );
          }
          const b = e.booking;
          const s = toLocal(b.startAt.getTime(), tz);
          const isNow = b.status === "active" && b.startAt.getTime() <= nowMs && b.endAt.getTime() > nowMs;
          const past = b.endAt.getTime() <= nowMs || b.status !== "active";
          return (
            <div key={b.id} className="contents">
              {head}
              <div className={`grid grid-cols-[56px_1fr_42px] items-center gap-2.5 rounded-[14px] border bg-white p-3 ${isNow ? "border-transparent ring-2 ring-accent" : "border-zinc-200"} ${past && !isNow ? "opacity-55" : ""}`}>
                <Link href={`/cabinet/b/${b.id}`} className="text-[16.5px] font-bold">
                  {hhmm(s.minutes)}
                  <small className="block text-[11.5px] font-medium text-zinc-500">{Math.round((b.endAt.getTime() - b.startAt.getTime()) / 60000)} мин</small>
                </Link>
                <Link href={`/cabinet/b/${b.id}`} className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5 text-[15px] font-semibold">
                    {b.clientName || "Без имени"} <Tag source={b.source} />
                    {b.status !== "active" && <span className="text-[11px] font-semibold text-red-700">{STATUS_LABEL[b.status]}</span>}
                  </div>
                  <div className="mt-0.5 text-[13px] leading-snug text-zinc-500">
                    {[b.car, b.serviceName].filter(Boolean).join(", ")}
                    {b.comment ? `. «${b.comment}»` : ""}
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
            </div>
          );
        })}
      </div>
    </>
  );
}
