import Link from "next/link";
import { CaretLeft, CaretRight, Globe, UsersThree } from "@phosphor-icons/react/dist/ssr";
import { requireOwner } from "@/lib/auth";
import { assignLanes, calendarLanes, sideBySide } from "@/lib/calendar";
import { loadCalendar } from "@/lib/cabinet";
import { ensureStaff } from "@/lib/staff";
import { addDays, formatDayShort, hhmm, isDateString, toLocal, weekdayOf } from "@/lib/time";
import { PageHead } from "../ui";
import { GridClick } from "./grid-click";

// Календарь как в Google: сетка по времени, на день одна колонка, запись — плашка на всю ширину в цвете поста.
// Записи в одно время встают рядом. «Месяц» — клетка на день со списком записей. Нажали на пустое место — новая запись.
const HOUR = 72; // высота часа, px: в получасовую запись влезают две строки

type View = "day" | "week" | "month";
const VIEWS: { v: View; label: string }[] = [{ v: "day", label: "День" }, { v: "week", label: "Неделя" }, { v: "month", label: "Месяц" }];
const MONTHS = ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"];
const WEEKDAYS = ["", "Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота", "Воскресенье"];

/** Первое число следующего месяца. */
const nextMonth = (d: string) => { const [y, m] = d.split("-").map(Number); return m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`; };

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ view?: string; date?: string; hide?: string }> }) {
  const { business } = await requireOwner();
  const tz = business.timezone;
  const sp = await searchParams;
  const view: View = sp.view === "day" || sp.view === "month" ? sp.view : "week";
  const today = toLocal(Date.now(), tz).date;
  const date = sp.date && isDateString(sp.date) ? sp.date : today;
  // Месяц: полные недели с понедельника, в которые попадают его дни
  const monthStart = `${date.slice(0, 8)}01`;
  const monthEnd = addDays(nextMonth(date), -1);
  const first = view === "week" ? addDays(date, 1 - weekdayOf(date)) : view === "month" ? addDays(monthStart, 1 - weekdayOf(monthStart)) : date;
  const last = view === "week" ? addDays(first, 6) : view === "month" ? addDays(monthEnd, 7 - weekdayOf(monthEnd)) : date;
  const dates: string[] = [];
  for (let d = first; d <= last; d = addDays(d, 1)) dates.push(d);
  await ensureStaff(business);
  const cal = await loadCalendar(business, dates);
  const lanes = calendarLanes(cal.staff, business.posts, business.standPosts);
  const hidden = new Set((sp.hide ?? "").split(",").filter(Boolean));
  const laneOf = assignLanes(
    cal.bookings.map((b) => ({ id: b.id, start: b.startAt.getTime(), end: b.endAt.getTime(), staffId: b.staffId, onStand: b.onStand })),
    lanes,
  );
  const color = (id: string) => lanes.find((l) => l.id === laneOf.get(id))?.color ?? "#475569";
  const visible = cal.bookings.filter((b) => !hidden.has(laneOf.get(b.id) ?? ""));

  // Часы сетки: от самого раннего открытия до самого позднего закрытия, и чтобы влезли записи вне часов
  const dayStart = new Map(cal.days.map((d) => [d.date, d.start]));
  const mins = (ms: number, day: string) => Math.round((ms - dayStart.get(day)!) / 60000);
  let from = Math.min(...cal.days.map((d) => d.win?.openMin ?? 9 * 60));
  let to = Math.max(...cal.days.map((d) => d.win?.closeMin ?? 20 * 60));
  for (const b of visible) {
    const day = toLocal(b.startAt.getTime(), tz).date;
    if (!dayStart.has(day)) continue;
    from = Math.min(from, mins(b.startAt.getTime(), day));
    to = Math.max(to, Math.min(24 * 60, mins(b.endAt.getTime(), day)));
  }
  from = Math.floor(from / 60) * 60;
  to = Math.ceil(to / 60) * 60;
  const height = ((to - from) / 60) * HOUR;
  const y = (m: number) => ((m - from) / 60) * HOUR;
  const hours = Array.from({ length: (to - from) / 60 }, (_, i) => from + i * 60);

  const link = (p: { view?: View; date?: string; hide?: Set<string> }) => {
    const h = [...(p.hide ?? hidden)].join(",");
    return `/cabinet/week?view=${p.view ?? view}&date=${p.date ?? date}${h ? `&hide=${h}` : ""}`;
  };
  const toggle = (id: string) => { const s = new Set(hidden); if (s.has(id)) s.delete(id); else s.add(id); return link({ hide: s }); };
  const shift = (n: number) => (view === "month" ? (n > 0 ? nextMonth(date) : `${addDays(monthStart, -1).slice(0, 8)}01`) : addDays(date, n * (view === "week" ? 7 : 1)));
  const a = formatDayShort(dates[0]), z = formatDayShort(dates[dates.length - 1]);
  // Заголовок — какой день открыт; «Сегодня» выделена, только когда сегодняшний день на экране
  const title =
    view === "month" ? `${MONTHS[Number(date.slice(5, 7)) - 1]} ${date.slice(0, 4)}`
    : view === "day" ? `${WEEKDAYS[weekdayOf(date)]}, ${a.day} ${a.month}`
    : a.month === z.month ? `${a.day}–${z.day} ${z.month}` : `${a.day} ${a.month} – ${z.day} ${z.month}`;
  const showsToday = view === "month" ? today >= monthStart && today <= monthEnd : today >= dates[0] && today <= dates[dates.length - 1];
  const step = { day: ["Прошлый день", "Следующий день"], week: ["Прошлая неделя", "Следующая неделя"], month: ["Прошлый месяц", "Следующий месяц"] }[view];

  const column = (day: string) => {
    const list = visible.filter((b) => {
      const s = mins(b.startAt.getTime(), day), e = mins(b.endAt.getTime(), day);
      return e > from && s < to && e > 0 && s < 24 * 60;
    });
    const pos = sideBySide(list.map((b) => ({ id: b.id, start: b.startAt.getTime(), end: b.endAt.getTime() })));
    const f = formatDayShort(day);
    return (
      <div key={day} className="relative min-w-0 border-l border-zinc-200" style={{ height }}>
        {hours.map((h) => <div key={h} className="pointer-events-none absolute inset-x-0 border-t border-zinc-200/80" style={{ top: y(h) }} />)}
        <GridClick date={day} fromMin={from} toMin={to} hourPx={HOUR} view={view === "day" ? "day" : "week"} label={`Новая запись: ${f.weekday} ${f.day} ${f.month}`} />
        {day === today && (() => {
          const now = toLocal(Date.now(), tz).minutes;
          return now > from && now < to ? <div className="pointer-events-none absolute inset-x-0 z-10 h-0.5 bg-red-500" style={{ top: y(now) }} /> : null;
        })()}
        {list.map((b) => {
          const s = Math.max(from, mins(b.startAt.getTime(), day)), e = Math.min(to, mins(b.endAt.getTime(), day));
          const p = pos.get(b.id) ?? { col: 0, cols: 1 };
          const t = `${hhmm(toLocal(b.startAt.getTime(), tz).minutes)}–${hhmm(toLocal(b.endAt.getTime(), tz).minutes)}`;
          // Запись с сайта: услуга, имя, машина; запись одним полем — весь её текст
          const text = [b.serviceName, b.clientName, b.car].filter(Boolean).join(", ");
          // В неделе при многих записях рядом плашка узкая: слова обрезаются, а не рвутся по буквам
          const narrow = view === "week" && p.cols >= 3;
          return (
            <Link key={b.id} href={`/cabinet/b/${b.id}`}
              className={`absolute z-[5] overflow-hidden rounded-md border border-white/70 text-white shadow-sm hover:z-20 hover:ring-2 hover:ring-ink ${narrow ? "px-0.5 text-[10.5px] leading-[13px]" : "hyphens-auto break-words px-1.5 py-0.5 text-[12px] leading-[15px]"} ${b.status === "no_show" ? "opacity-50 line-through" : ""}`}
              style={{ top: y(s) + 1, height: Math.max(17, y(e) - y(s) - 2), left: `calc(${(p.col / p.cols) * 100}% + 1px)`, width: `calc(${100 / p.cols}% - 2px)`, background: color(b.id) }}
              title={`${t} ${text}${b.source === "site" ? " (записался сам)" : ""}`}>
              {b.source === "site" && <Globe size={11} weight="bold" aria-label="Записался сам через сайт" className="mr-0.5 inline align-[-1px]" />}
              <b className={`tabular-nums ${narrow ? "block" : ""}`}>{hhmm(toLocal(b.startAt.getTime(), tz).minutes)}</b> {text}
            </Link>
          );
        })}
      </div>
    );
  };

  // Месяц: в клетке дня до трёх записей строкой «время, текст» цветом поста; нажали на день — вид «День»
  const month = () => (
    <div className="mx-3.5 overflow-hidden rounded-2xl bg-white ring-1 ring-zinc-200 lg:mx-0">
      <div className="grid grid-cols-7 border-b border-zinc-200 text-center text-[11.5px] text-zinc-500">
        {dates.slice(0, 7).map((d) => <span key={d} className="py-1.5">{formatDayShort(d).weekday}</span>)}
      </div>
      <div className="grid grid-cols-7">
        {dates.map((d) => {
          const list = visible.filter((b) => toLocal(b.startAt.getTime(), tz).date === d);
          const out = d < monthStart || d > monthEnd;
          const f = formatDayShort(d);
          return (
            <Link key={d} href={link({ view: "day", date: d })} aria-label={`${f.day} ${f.month}, записей ${list.length}`}
              className={`grid min-h-[92px] content-start gap-0.5 border-b border-l border-zinc-100 p-1 hover:bg-zinc-50 lg:min-h-[128px] ${out ? "text-zinc-400" : ""}`}>
              <span className={`justify-self-start rounded-full px-1.5 text-[13px] font-semibold tabular-nums ${d === today ? "bg-accent text-white" : ""}`}>{f.day}</span>
              {list.slice(0, 3).map((b) => (
                <span key={b.id} className={`flex min-w-0 items-center gap-1 rounded px-1 text-[11px] leading-[18px] text-white ${b.status === "no_show" ? "opacity-50 line-through" : ""} ${out ? "opacity-60" : ""}`}
                  style={{ background: color(b.id) }}>
                  {b.source === "site" && <Globe size={10} weight="bold" className="shrink-0" />}
                  <b className="tabular-nums">{hhmm(toLocal(b.startAt.getTime(), tz).minutes)}</b>
                  <span className="hidden truncate sm:inline">{b.serviceName}</span>
                </span>
              ))}
              {list.length > 3 && <span className="px-1 text-[11px] font-semibold text-zinc-500">ещё {list.length - 3}</span>}
            </Link>
          );
        })}
      </div>
    </div>
  );

  return (
    <>
      <PageHead kicker="Календарь" title={title}>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Link href={link({ date: shift(-1) })} aria-label={step[0]} className="grid size-10 place-items-center rounded-full bg-white ring-1 ring-zinc-200"><CaretLeft size={18} /></Link>
          <Link href={link({ date: today })} aria-current={showsToday ? "date" : undefined}
            className={`grid h-10 place-items-center rounded-full px-4 text-[14px] font-semibold ring-1 ${showsToday ? "bg-ink text-white ring-ink" : "bg-white ring-zinc-200"}`}>
            Сегодня
          </Link>
          <Link href={link({ date: shift(1) })} aria-label={step[1]} className="grid size-10 place-items-center rounded-full bg-white ring-1 ring-zinc-200"><CaretRight size={18} /></Link>
          <div className="ml-auto grid grid-cols-3 gap-1 rounded-xl bg-zinc-200/70 p-1" role="group" aria-label="Вид">
            {VIEWS.map(({ v, label }) => (
              <Link key={v} href={link({ view: v })} aria-current={view === v ? "page" : undefined}
                className={`grid h-9 place-items-center rounded-lg px-3 text-[14px] font-semibold ${view === v ? "bg-white shadow-sm" : "text-zinc-600"}`}>
                {label}
              </Link>
            ))}
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-1.5" aria-label="Посты: нажмите, чтобы скрыть или показать">
          {lanes.map((l) => {
            const off = hidden.has(l.id);
            return (
              <Link key={l.id} href={toggle(l.id)} aria-pressed={!off}
                className={`inline-flex h-9 items-center gap-2 rounded-full bg-white px-3 text-[13.5px] font-semibold ring-1 ${off ? "text-zinc-400 ring-zinc-200" : "text-ink ring-zinc-300"}`}>
                <i className="size-3 rounded-full" style={{ background: off ? "transparent" : l.color, boxShadow: `inset 0 0 0 2px ${l.color}` }} />
                {l.name}
              </Link>
            );
          })}
          <Link href="/cabinet/week/staff" className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-[13.5px] font-semibold text-accent">
            <UsersThree size={17} /> Посты и цвета
          </Link>
        </div>
      </PageHead>

      {view === "month" ? month() : (
        <div className="mx-3.5 overflow-x-auto rounded-2xl bg-white ring-1 ring-zinc-200 lg:mx-0">
          <div className="grid" style={{ gridTemplateColumns: `44px repeat(${dates.length}, minmax(${view === "day" ? 200 : 130}px, 1fr))` }}>
            {view === "week" && (
              <>
                <div className="sticky top-0 z-30 border-b border-zinc-200 bg-white" />
                {dates.map((d) => {
                  const f = formatDayShort(d);
                  return (
                    <Link key={d} href={link({ view: "day", date: d })} className={`sticky top-0 z-30 grid justify-items-center border-b border-l border-zinc-200 bg-white py-1.5 ${d === today ? "text-accent" : ""}`}>
                      <span className="text-[11.5px] text-zinc-500">{f.weekday}</span>
                      <b className="text-[17px] leading-tight tabular-nums">{f.day}</b>
                    </Link>
                  );
                })}
              </>
            )}
            <div className="relative" style={{ height }}>
              {hours.map((h) => (
                <span key={h} className="absolute right-1.5 -translate-y-1/2 text-[11px] tabular-nums text-zinc-500" style={{ top: y(h) }}>{h > from ? hhmm(h) : ""}</span>
              ))}
            </div>
            {dates.map(column)}
          </div>
        </div>
      )}
      <p className="mx-3.5 mt-2 mb-6 flex items-center gap-1.5 text-[12.5px] text-zinc-500 lg:mx-0">
        <Globe size={13} weight="bold" className="shrink-0" /> записался сам через сайт. {view === "month" ? "Нажмите на день, чтобы открыть его." : "Нажмите на пустое место, чтобы записать на это время."}
      </p>
    </>
  );
}
