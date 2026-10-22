import Link from "next/link";
import { CaretLeft, CaretRight, Globe, UsersThree } from "@phosphor-icons/react/dist/ssr";
import { requireOwner } from "@/lib/auth";
import { assignLanes, calendarLanes, sideBySide, type Lane } from "@/lib/calendar";
import { loadCalendar } from "@/lib/cabinet";
import { addDays, formatDayShort, hhmm, isDateString, toLocal, weekdayOf } from "@/lib/time";
import { PageHead } from "../ui";
import { GridClick } from "./grid-click";

// Календарь как в Google: сетка по времени, записи блоками в цвете сотрудника. «День» — колонка на сотрудника,
// «Неделя» — колонка на день, «Месяц» — клетка на день со списком записей. Нажали на пустое место — новая запись на это время.
const HOUR = 56; // высота часа, px

type View = "day" | "week" | "month";
const VIEWS: { v: View; label: string }[] = [{ v: "day", label: "День" }, { v: "week", label: "Неделя" }, { v: "month", label: "Месяц" }];
const MONTHS = ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"];

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
  const count = view === "week" ? 7 : view === "month" ? (() => { let n = 0; while (addDays(first, n) <= addDays(monthEnd, 7 - weekdayOf(monthEnd))) n++; return n; })() : 1;
  const dates = Array.from({ length: count }, (_, i) => addDays(first, i));
  const cal = await loadCalendar(business, dates);
  const lanes = calendarLanes(cal.staff, business.posts, business.standPosts);
  const hidden = new Set((sp.hide ?? "").split(",").filter(Boolean));
  const shown = lanes.filter((l) => !hidden.has(l.id));
  const laneOf = assignLanes(
    cal.bookings.map((b) => ({ id: b.id, start: b.startAt.getTime(), end: b.endAt.getTime(), staffId: b.staffId, onStand: b.onStand })),
    lanes,
  );
  const laneById = new Map(lanes.map((l) => [l.id, l]));

  // Часы сетки: от самого раннего открытия до самого позднего закрытия, и чтобы влезли записи вне часов
  const mins = (ms: number, day: string) => Math.round((ms - cal.days.find((d) => d.date === day)!.start) / 60000);
  let from = Math.min(...cal.days.map((d) => d.win?.openMin ?? 9 * 60));
  let to = Math.max(...cal.days.map((d) => d.win?.closeMin ?? 20 * 60));
  for (const b of cal.bookings) {
    const day = toLocal(b.startAt.getTime(), tz).date;
    if (!dates.includes(day)) continue;
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
  const kicker = view === "month" ? `${MONTHS[Number(date.slice(5, 7)) - 1]} ${date.slice(0, 4)}` : view === "day" ? `${a.weekday}, ${a.day} ${a.month}` : a.month === z.month ? `${a.day}–${z.day} ${z.month}` : `${a.day} ${a.month} – ${z.day} ${z.month}`;
  const prevLabel = view === "month" ? "Прошлый месяц" : view === "week" ? "Прошлая неделя" : "Прошлый день";
  const nextLabel = view === "month" ? "Следующий месяц" : view === "week" ? "Следующая неделя" : "Следующий день";

  // Закрытое время дня: до открытия, после закрытия, обед, закрыт весь сервис
  const closed = (day: (typeof cal.days)[number]) => {
    const out: { from: number; to: number }[] = [];
    if (!day.win) return [{ from, to }];
    if (day.win.openMin > from) out.push({ from, to: day.win.openMin });
    if (day.win.closeMin < to) out.push({ from: day.win.closeMin, to });
    if (day.win.breakFrom != null && day.win.breakTo != null) out.push({ from: day.win.breakFrom, to: day.win.breakTo });
    for (const bl of cal.blocks.filter((b) => b.scope === "all")) {
      const s = Math.max(from, mins(bl.startAt.getTime(), day.date)), e = Math.min(to, mins(bl.endAt.getTime(), day.date));
      if (e > s) out.push({ from: s, to: e });
    }
    return out;
  };

  const bookingsOf = (day: string, lane?: Lane) =>
    cal.bookings.filter((b) => {
      const l = laneById.get(laneOf.get(b.id) ?? "");
      if (!l || hidden.has(l.id) || (lane && l.id !== lane.id)) return false;
      const s = mins(b.startAt.getTime(), day), e = mins(b.endAt.getTime(), day);
      return e > from && s < to && toLocal(b.startAt.getTime(), tz).date <= day && toLocal(b.endAt.getTime() - 1, tz).date >= day;
    });

  const column = (key: string, day: (typeof cal.days)[number], lane?: Lane) => {
    const list = bookingsOf(day.date, lane);
    const pos = sideBySide(list.map((b) => ({ id: b.id, start: b.startAt.getTime(), end: b.endAt.getTime() })));
    return (
      <div key={key} className="relative min-w-0 border-l border-zinc-200" style={{ height }}>
        {closed(day).map((c, i) => (
          <div key={i} className="absolute inset-x-0 bg-[repeating-linear-gradient(135deg,#f1f1f3_0_6px,#e8e8ec_6px_12px)]" style={{ top: y(c.from), height: y(c.to) - y(c.from) }} />
        ))}
        {hours.map((h) => <div key={h} className="pointer-events-none absolute inset-x-0 border-t border-zinc-200/80" style={{ top: y(h) }} />)}
        <GridClick date={day.date} fromMin={from} toMin={to} hourPx={HOUR} staff={lane && !lane.virtual ? lane.id : undefined} view={view === "day" ? "day" : "week"}
          label={`Новая запись: ${formatDayShort(day.date).weekday} ${formatDayShort(day.date).day}${lane ? `, ${lane.name}` : ""}`} />
        {day.date === toLocal(Date.now(), tz).date && (() => {
          const now = toLocal(Date.now(), tz).minutes;
          return now > from && now < to ? <div className="pointer-events-none absolute inset-x-0 z-10 h-0.5 bg-red-500" style={{ top: y(now) }} /> : null;
        })()}
        {list.map((b) => {
          const l = laneById.get(laneOf.get(b.id)!)!;
          const s = Math.max(from, mins(b.startAt.getTime(), day.date)), e = Math.min(to, mins(b.endAt.getTime(), day.date));
          const p = pos.get(b.id) ?? { col: 0, cols: 1 };
          const short = e - s <= 45;
          return (
            <Link key={b.id} href={`/cabinet/b/${b.id}`}
              className={`absolute z-[5] overflow-hidden rounded-md border border-white/60 px-1.5 py-0.5 text-[11.5px] leading-tight text-white shadow-sm hover:z-20 hover:ring-2 hover:ring-ink ${b.status === "no_show" ? "opacity-50 line-through" : ""}`}
              style={{ top: y(s) + 1, height: Math.max(18, y(e) - y(s) - 2), left: `calc(${(p.col / p.cols) * 100}% + 1px)`, width: `calc(${100 / p.cols}% - 2px)`, background: l.color }}
              title={`${hhmm(toLocal(b.startAt.getTime(), tz).minutes)}–${hhmm(toLocal(b.endAt.getTime(), tz).minutes)} ${b.serviceName}${b.clientName ? `, ${b.clientName}` : ""}${b.source === "site" ? " (записался сам)" : ""}`}>
              <span className="flex items-center gap-1 font-semibold tabular-nums">
                {b.source === "site" && <Globe size={11} weight="bold" aria-label="Записался сам через сайт" className="shrink-0" />}
                {hhmm(toLocal(b.startAt.getTime(), tz).minutes)}
                {short && <span className="truncate font-normal">{b.serviceName}</span>}
              </span>
              {!short && <span className="block truncate">{b.serviceName}</span>}
              {!short && (b.clientName || b.car) && <span className="block truncate opacity-85">{[b.clientName, b.car].filter(Boolean).join(", ")}</span>}
            </Link>
          );
        })}
      </div>
    );
  };

  // Месяц: в клетке дня до трёх записей строкой «время, что делаем» цветом сотрудника; нажали на день — вид «День»
  const month = () => (
    <div className="mx-3.5 overflow-hidden rounded-2xl bg-white ring-1 ring-zinc-200 lg:mx-0">
      <div className="grid grid-cols-7 border-b border-zinc-200 text-center text-[11.5px] text-zinc-500">
        {dates.slice(0, 7).map((d) => <span key={d} className="py-1.5">{formatDayShort(d).weekday}</span>)}
      </div>
      <div className="grid grid-cols-7">
        {cal.days.map((d) => {
          const list = cal.bookings.filter((b) => toLocal(b.startAt.getTime(), tz).date === d.date && !hidden.has(laneOf.get(b.id) ?? ""));
          const out = d.date < monthStart || d.date > monthEnd;
          return (
            <Link key={d.date} href={link({ view: "day", date: d.date })} aria-label={`${formatDayShort(d.date).day} ${formatDayShort(d.date).month}, записей ${list.length}`}
              className={`grid min-h-[92px] content-start gap-0.5 border-b border-l border-zinc-100 p-1 hover:bg-zinc-50 lg:min-h-[120px] ${out ? "bg-zinc-50/70 text-zinc-400" : ""} ${!d.win && !out ? "bg-[repeating-linear-gradient(135deg,#fafafa_0_6px,#f1f1f3_6px_12px)]" : ""}`}>
              <span className={`justify-self-start rounded-full px-1.5 text-[13px] font-semibold tabular-nums ${d.date === today ? "bg-accent text-white" : ""}`}>{formatDayShort(d.date).day}</span>
              {list.slice(0, 3).map((b) => (
                <span key={b.id} className={`flex min-w-0 items-center gap-1 rounded px-1 text-[11px] leading-[18px] text-white ${b.status === "no_show" ? "opacity-50 line-through" : ""}`}
                  style={{ background: laneById.get(laneOf.get(b.id) ?? "")?.color ?? "#475569" }}>
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

  const cols = view === "day" ? shown.length : 7;
  return (
    <>
      <PageHead kicker={kicker} title="Календарь">
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Link href={link({ date: shift(-1) })} aria-label={prevLabel} className="grid size-10 place-items-center rounded-full bg-white ring-1 ring-zinc-200"><CaretLeft size={18} /></Link>
          <Link href={link({ date: today })} className="grid h-10 place-items-center rounded-full bg-white px-4 text-[14px] font-semibold ring-1 ring-zinc-200">Сегодня</Link>
          <Link href={link({ date: shift(1) })} aria-label={nextLabel} className="grid size-10 place-items-center rounded-full bg-white ring-1 ring-zinc-200"><CaretRight size={18} /></Link>
          <div className="ml-auto grid grid-cols-3 gap-1 rounded-xl bg-zinc-200/70 p-1" role="group" aria-label="Вид">
            {VIEWS.map(({ v, label }) => (
              <Link key={v} href={link({ view: v })} aria-current={view === v ? "page" : undefined}
                className={`grid h-9 place-items-center rounded-lg px-3 text-[14px] font-semibold ${view === v ? "bg-white shadow-sm" : "text-zinc-600"}`}>
                {label}
              </Link>
            ))}
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-1.5" aria-label="Сотрудники">
          {lanes.map((l) => {
            const off = hidden.has(l.id);
            return (
              <Link key={l.id} href={toggle(l.id)} aria-pressed={!off}
                className={`inline-flex h-9 items-center gap-2 rounded-full px-3 text-[13.5px] font-semibold ring-1 ${off ? "bg-white text-zinc-400 ring-zinc-200" : "bg-white text-ink ring-zinc-300"}`}>
                <i className="size-3 rounded-full" style={{ background: off ? "transparent" : l.color, boxShadow: `inset 0 0 0 2px ${l.color}` }} />
                {l.name}
              </Link>
            );
          })}
          <Link href="/cabinet/week/staff" className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-[13.5px] font-semibold text-accent">
            <UsersThree size={17} /> {cal.staff.length ? "Сотрудники" : "Добавить сотрудников"}
          </Link>
        </div>
      </PageHead>

      {view === "month" ? month() : (
      <div className="mx-3.5 overflow-x-auto rounded-2xl bg-white ring-1 ring-zinc-200 lg:mx-0">
        <div className="grid" style={{ gridTemplateColumns: `44px repeat(${Math.max(cols, 1)}, minmax(${view === "day" ? 110 : 64}px, 1fr))` }}>
          <div className="sticky top-0 z-30 border-b border-zinc-200 bg-white" />
          {view === "week"
            ? dates.map((d) => {
                const f = formatDayShort(d);
                return (
                  <Link key={d} href={link({ view: "day", date: d })} className={`sticky top-0 z-30 grid justify-items-center border-b border-l border-zinc-200 bg-white py-1.5 ${d === today ? "text-accent" : ""}`}>
                    <span className="text-[11.5px] text-zinc-500">{f.weekday}</span>
                    <b className="text-[17px] leading-tight tabular-nums">{f.day}</b>
                  </Link>
                );
              })
            : shown.map((l) => (
                <div key={l.id} className="sticky top-0 z-30 flex items-center justify-center gap-1.5 border-b border-l border-zinc-200 bg-white px-1 py-2.5 text-[13px] font-semibold">
                  <i className="size-2.5 shrink-0 rounded-full" style={{ background: l.color }} />
                  <span className="truncate">{l.name}</span>
                </div>
              ))}
          <div className="relative" style={{ height }}>
            {hours.map((h) => (
              <span key={h} className="absolute right-1.5 -translate-y-1/2 text-[11px] tabular-nums text-zinc-500" style={{ top: y(h) }}>{h > from ? hhmm(h) : ""}</span>
            ))}
          </div>
          {view === "week" ? cal.days.map((d) => column(d.date, d)) : shown.map((l) => column(l.id, cal.days[0], l))}
          {view === "day" && !shown.length && <p className="p-6 text-[14px] text-zinc-500">Все сотрудники скрыты. Нажмите на имя вверху, чтобы показать.</p>}
        </div>
      </div>
      )}
      <p className="mx-3.5 mt-2 mb-6 flex items-center gap-1.5 text-[12.5px] text-zinc-500 lg:mx-0">
        <Globe size={13} weight="bold" /> записался сам через сайт. {view === "month" ? "Нажмите на день, чтобы открыть его по сотрудникам." : "Нажмите на пустое место, чтобы записать на это время."}
      </p>
    </>
  );
}
